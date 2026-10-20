import re
import socket

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sympy import (
    Abs, Add, E, Eq, Float, Integer, Mul, Poly, Pow, Rational, Symbol, cos, diff, exp, expand, integrate, latex, log, pi,
    simplify, sin, solve, sqrt, tan,
)
from sympy.parsing.sympy_parser import (
    convert_xor, implicit_multiplication_application, parse_expr, standard_transformations,
)

app = FastAPI(title="Solver Service")

FUNCTIONS = {"sqrt": sqrt, "sin": sin, "cos": cos, "tan": tan, "ln": log, "log": log, "exp": exp, "abs": Abs}
CONSTANTS = {"pi": pi, "e": E}
VARIABLES = set("abcdfghjklmnpqrstuvwxyz")
TRANSFORMS = standard_transformations + (implicit_multiplication_application, convert_xor)
GLOBALS = {"Add": Add, "Mul": Mul, "Pow": Pow, "Integer": Integer, "Float": Float, "Rational": Rational, "Symbol": Symbol, "__builtins__": {}, **FUNCTIONS, **CONSTANTS}
ALLOWED = re.compile(r"^[0-9A-Za-z+\-*/^().,\s]*$")
MAX_EXPONENT = 100


class Expr(BaseModel):
    expr: str = Field(max_length=200)
    variable: str | None = Field(None, pattern="^[a-z]$")


class Equation(BaseModel):
    equation: str = Field(max_length=200)
    variable: str | None = Field(None, pattern="^[a-z]$")


class Derivative(Expr):
    at: float | None = None


class Integral(Expr):
    lower: float | None = None
    upper: float | None = None


class Equivalence(BaseModel):
    a: str = Field(max_length=200)
    b: str = Field(max_length=200)
    form: str = Field("any", pattern="^(any|expanded|factored|simplified)$")


def tidy(text):
    return (text.replace("−", "-").replace("–", "-").replace("×", "*").replace("÷", "/")
            .replace("π", "pi").replace("√", "sqrt").replace("**", "^"))


def check_names(text):
    for name in re.findall(r"[A-Za-z]+", text):
        if name not in FUNCTIONS and name not in CONSTANTS and not set(name) <= VARIABLES:
            raise HTTPException(400, f"Unknown name: {name}")


def check_powers(node):
    """Reject huge powers like 9^9^9 or 2^100000 before SymPy tries to compute them (innermost first)."""
    for arg in node.args:
        check_powers(arg)
    if isinstance(node, Pow) and node.exp.is_number and abs(complex(node.exp.evalf())) > MAX_EXPONENT:
        raise HTTPException(400, f"Exponents above {MAX_EXPONENT} are not supported")


def parse(text, keep_form=False):
    """Read a typed expression. keep_form=True returns it exactly as written, e.g. 2(x+1) not 2x + 2."""
    text = tidy(text).strip()
    if not text or not ALLOWED.match(text):
        raise HTTPException(400, "Use numbers, letters, + - * / ^ and brackets")
    check_names(text)
    local = {c: Symbol(c) for c in VARIABLES}
    try:
        written = parse_expr(text, local_dict=local, global_dict=GLOBALS, transformations=TRANSFORMS, evaluate=False)
        check_powers(written)
        return written if keep_form else parse_expr(text, local_dict=local, global_dict=GLOBALS, transformations=TRANSFORMS)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(400, "Could not read that expression")


def variable_of(expr, name):
    if name:
        return Symbol(name)
    symbols = sorted(expr.free_symbols, key=str)
    return symbols[0] if len(symbols) == 1 else Symbol("x")


def show(value):
    """Plain text (as a student would type it) and LaTeX."""
    text = str(value).replace("**", "^").replace("log(", "ln(")
    text = re.sub(r"\bI\b", "i", text)
    text = re.sub(r"(?<=[\d)])\*(?=[a-z(])", "", text)
    return {"result": text, "latex": latex(value, ln_notation=True)}


def number(value):
    out = show(value)
    if value.is_number and value.is_real:
        out["decimal"] = float(value.evalf())
    return out


@app.get("/")
def root():
    return {"service": "solver", "pod": socket.gethostname()}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/evaluate")
def evaluate(body: Expr):
    """Evaluate an expression with no variables, exactly and as a decimal."""
    value = simplify(parse(body.expr))
    if not value.is_number:
        raise HTTPException(400, "Expression has variables; use /simplify")
    if not value.is_finite:
        raise HTTPException(400, "The value is undefined")
    return number(value)


@app.post("/simplify")
def simplify_expr(body: Expr):
    """Simplify an expression."""
    return show(simplify(parse(body.expr)))


@app.post("/expand")
def expand_expr(body: Expr):
    """Expand an expression."""
    return show(expand(parse(body.expr)))


@app.post("/factor")
def factor_expr(body: Expr):
    """Factorise an expression."""
    from sympy import factor
    return show(factor(parse(body.expr)))


@app.post("/solve")
def solve_equation(body: Equation):
    """Solve an equation such as 2x + 3 = 7; without =, solves expression = 0."""
    sides = body.equation.split("=")
    if len(sides) > 2:
        raise HTTPException(400, "Use at most one =")
    left = parse(sides[0])
    right = parse(sides[1]) if len(sides) == 2 else Integer(0)
    var = variable_of(left - right, body.variable)
    solutions = solve(Eq(left, right), var)
    solutions = sorted(solutions, key=lambda s: (not s.is_real, float(s.evalf()) if s.is_real else 0))
    return {"variable": str(var), "solutions": [number(s) for s in solutions]}


@app.post("/derivative")
def derivative(body: Derivative):
    """Differentiate an expression; give at to also evaluate the derivative at that point."""
    expr = parse(body.expr)
    var = variable_of(expr, body.variable)
    result = show(simplify(diff(expr, var)))
    if body.at is not None:
        result["value"] = number(nice(diff(expr, var).subs(var, body.at)))
    return result


@app.post("/integral")
def integral(body: Integral):
    """Integrate an expression; give lower and upper for a definite integral."""
    expr = parse(body.expr)
    var = variable_of(expr, body.variable)
    if (body.lower is None) != (body.upper is None):
        raise HTTPException(400, "Give both lower and upper, or neither")
    if body.lower is None:
        anti = show(integrate(expr, var))
        return {"result": anti["result"] + " + c", "latex": anti["latex"] + " + c"}
    return number(nice(integrate(expr, (var, body.lower, body.upper))))


@app.post("/equivalent")
def equivalent(body: Equivalence):
    """Is a equal to b for every value of the variables? form also checks a is written expanded, fully factorised or
    simplified (no more terms than b)."""
    a, b = parse(body.a), parse(body.b)
    same = simplify(a - b) == 0
    if same and body.form == "expanded":
        same = expanded(parse(body.a, keep_form=True))
    if same and body.form == "factored":
        same = fully_factored(parse(body.a, keep_form=True))
    if same and body.form == "simplified":
        written = parse(body.a, keep_form=True)
        same = expanded(written) and len(Add.make_args(written)) <= len(Add.make_args(expand(b)))
    return {"equivalent": bool(same)}


def expanded(expr):
    """No brackets left to multiply out: no product containing a sum, no sum raised to a power."""
    if isinstance(expr, Mul) and any(isinstance(arg, Add) for arg in expr.args):
        return False
    if isinstance(expr, Pow) and isinstance(expr.base, Add) and expr.exp.is_Integer and expr.exp > 1:
        return False
    return all(expanded(arg) for arg in expr.args)


def fully_factored(expr):
    """Every non-constant factor has no common number factor and can't be factorised further, e.g. 2(x+1)(x+3)."""
    if isinstance(expr, Mul) and len(expr.args) == 2 and expr.args[0] == -1:
        expr = expr.args[1]
    for f in Mul.make_args(expr):
        base = f.base if isinstance(f, Pow) and f.exp.is_Integer and f.exp > 0 else f
        base = expand(base)
        if base.is_number:
            continue
        try:
            poly = Poly(base, *sorted(base.free_symbols, key=str))
        except Exception:
            return False
        if abs(poly.content()) != 1 or not poly.is_irreducible:
            return False
    return True


def nice(value):
    """Turn floats from at/lower/upper back into exact numbers where possible, e.g. 2.0 -> 2."""
    from sympy import nsimplify
    return nsimplify(value, rational=True) if value.is_number else value
