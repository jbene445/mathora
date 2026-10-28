# Mathora: cloud code explained

Read with the linked source file open. For each block, explain **what it creates/configures, why it exists, and what changes when it runs**. These are explanations and example commands; no cloud operations were performed while writing this document.

| File | Responsibility |
|---|---|
| `backend/*/Dockerfile` | Package a backend application |
| `frontend/*/Dockerfile` | Build frontend files and package Nginx |
| `database/Dockerfile` | Package PostgreSQL with initial schema/seed scripts |
| `infrastructure/docker-compose.yaml` | Connect and run the components locally |
| `infrastructure/kubernetes/*.yaml` | Describe desired cloud workloads, network Services, and storage |
| `frontend/*/nginx.conf` | Serve frontend files and route API requests |
| `DEPLOY.md` | Build, deploy, and operate the cloud environment |

## 1. Backend Dockerfiles

**Open:** [Account Dockerfile](backend/account/Dockerfile). All seven backend Dockerfiles use the same instructions; their directory supplies different code and dependencies.

```dockerfile
FROM python:3.13-slim
WORKDIR /app
COPY . .
RUN pip install -r requirements.txt
EXPOSE 8000
CMD ["fastapi", "run", "main.py"]
```

| Line | Meaning | Why it matters |
|---|---|---|
| `FROM python:3.13-slim` | Start from a Python 3.13 base image | Supplies Python and a small OS environment |
| `WORKDIR /app` | Set the working directory inside the image/container | Later relative destinations and the startup command use it |
| `COPY . .` | Copy the submitted build context into the working directory | Packages your source and requirements |
| `RUN pip install -r requirements.txt` | Install the listed packages while building | The resulting image includes the app's dependencies |
| `EXPOSE 8000` | Record the intended application port | Does not publish the port or make the app public |
| `CMD [...]` | Default command when a container starts | Starts FastAPI's server for `main.py` |

**Build time vs runtime:** dependency installation occurs while constructing the image. Starting a container later executes CMD. Incoming requests do not reinstall requirements. Editing source does not change a built image; build and deploy a new image to run changed code.

**The two dots:** the first is the source in the build context; the second is the destination inside the image. With `gcloud builds submit ... backend/account`, the context is `backend/account`, not automatically the whole repository.

**What the dependencies do:** [requirements.txt](backend/account/requirements.txt) includes FastAPI with server tooling and Psycopg with PostgreSQL connection/pooling support. FastAPI defines routes and validation; its server handles HTTP requests; Psycopg talks to PostgreSQL.

**Possible improvements:** copy/install dependency files before frequently changing code to improve cache reuse; exclude unnecessary context with `.dockerignore`; pin dependencies/images appropriately; choose runtime privileges deliberately. These are possible improvements, not all configured here. Instruction semantics: [Dockerfile reference](https://docs.docker.com/reference/dockerfile/).

## 2. Frontend Dockerfiles

**Open:** [Student Dockerfile](frontend/student/Dockerfile).

```dockerfile
FROM node:24-slim AS build
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### Stage one: build the website

`FROM ... AS build` names a build stage containing Node. `npm ci` installs dependencies according to the lockfile; `npm run build` runs the project's build script. Your frontend script performs TypeScript checking/build work and Vite bundling, producing `dist`.

### Stage two: serve the website

The second `FROM` starts a separate Nginx stage. `COPY --from=build` transfers the generated files from the first stage. The other COPY installs your routing configuration. The final image serves files on 80 and inherits Nginx's startup configuration.

**Why two stages?** The build needs Node and development tools; serving the result needs Nginx and static files. The final image avoids carrying the whole build environment. React executes in the user's browser, not as a Python backend or a Node development server.

The [Developer Dockerfile](frontend/developer/Dockerfile) additionally copies `api.conf`. It uses `npm ci --ignore-scripts`, suppressing install lifecycle scripts; the separate `npm run build` still explicitly invokes the build script. See [npm ci documentation](https://docs.npmjs.com/cli/v11/commands/npm-ci/).

## 3. Database Dockerfile

**Open:** [database/Dockerfile](database/Dockerfile).

```dockerfile
FROM postgres:17
COPY schema.sql /docker-entrypoint-initdb.d/01-schema.sql
COPY data/curriculum.sql /docker-entrypoint-initdb.d/02-curriculum.sql
COPY data/questions.sql /docker-entrypoint-initdb.d/03-questions.sql
COPY data/accounts.sql /docker-entrypoint-initdb.d/04-accounts.sql
EXPOSE 5432
```

The base image supplies PostgreSQL and its startup logic. COPY packages initialisation scripts; it does not execute those SQL statements during image construction. At first startup with an empty database data directory, the inherited startup logic runs scripts in name order: schema before data. Existing database contents are not recreated every restart.

**Important consequence:** rebuilding this image with changed SQL does not migrate an existing populated database. A migration process is needed. Database files must also live on persistent storage to survive replacement. See the [official PostgreSQL image documentation](https://hub.docker.com/_/postgres).

## 4. Docker Compose: the local system

**Open:** [docker-compose.yaml](infrastructure/docker-compose.yaml). Paths such as `../backend/account` are relative to the Compose file's directory.

Your account block:

```yaml
  account:
    build: ../backend/account
    environment:
      DATABASE_URL: postgresql://mathora:mathora@database:5432/mathora
    depends_on:
      - database
    ports:
      - "8007:8000"
    networks:
      - app-network
```

| Field | Explanation |
|---|---|
| Top-level `services` | Lists application components; a Compose service differs from a Kubernetes Service |
| `account` | Component name, also usable for discovery on its Compose network |
| `build` | Directory containing its Dockerfile/build context |
| `environment` | Values supplied to the process at runtime |
| `depends_on` | Start dependencies before this component; short form does not wait for readiness |
| `ports` | Publish host port 8007 to container port 8000 |
| `networks` | Attach this container to the named application network |

**Why host/container ports differ:** a browser on your computer uses `localhost:8007`; containers use `account:8000`. Most backends listen internally on 8000 but publish different host ports to avoid host conflicts. Separate container network environments can reuse 8000.

**Why not `localhost` for PostgreSQL?** From the account container, localhost refers to that container's network environment. `database` resolves the separate database container on the Compose network.

The connection string means `postgresql://USER:PASSWORD@HOST:PORT/DATABASE`. Python reads `DATABASE_URL` to create its pool. Values such as `SOLVER_URL: http://solver:8000` likewise tell one service how to reach another; they do not start the remote service themselves.

### Storage and network definitions

The database mounts `database:/var/lib/postgresql/data`. The left side is a named volume, not the hostname. The right side is the directory inside the container. Top-level `volumes: database: {}` declares that volume. The network definition uses `driver: bridge`, providing a local network for the containers.

`restart: always` on the database requests process/container restart behaviour; it does not create replicas or backups. `depends_on` does not continuously monitor dependency health. Waiting for a healthy dependency requires a healthcheck and suitable dependency condition, not currently configured here. [Compose startup behaviour](https://docs.docker.com/compose/how-tos/startup-order/)

### Explain the local commands

Run these from `infrastructure`, as in the README:

```bash
# Create/start the local system; -d runs it in the background.
docker compose up -d

# Rebuild images before bringing the services up.
docker compose up -d --build

# Show local container state.
docker compose ps

# Stop and remove Compose containers/networks; named volumes remain by default.
docker compose down
```

The Dockerfiles package applications; Compose describes how to run them together locally. Neither alone establishes a multi-node cloud deployment.

## 5. Kubernetes: the account manifest

**Open:** [account.yaml](infrastructure/kubernetes/account.yaml).

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
    name: account
spec:
    replicas: 2
    selector:
        matchLabels:
            run: account
    template:
        metadata:
            labels:
                run: account
        spec:
            containers:
            - name: account
              image: mathora-account:v1
              readinessProbe:
                httpGet:
                  path: /health
                  port: 8000
              lifecycle:
                preStop:
                  exec:
                    command: ["sleep", "5"]
              env:
              - name: DATABASE_URL
                value: postgresql://mathora:mathora@database:5432/mathora
---
apiVersion: v1
kind: Service
metadata:
    name: account
spec:
    selector:
        run: account
    ports:
    - port: 8000
```

### Deployment: what should run

| Field | Meaning |
|---|---|
| `apiVersion: apps/v1` | Kubernetes API schema; not the app's v1 image tag |
| `kind: Deployment` | Manage replicated pods and pod-template versions |
| `metadata.name` | Resource name |
| Outer `spec` | Desired Deployment configuration |
| `replicas: 2` | Maintain two account pod replicas |
| `selector.matchLabels` | Identify managed pods |
| `template` | Blueprint for newly created pods |
| `template.metadata.labels` | Apply `run: account` to those pods |
| `template.spec` | Desired pod configuration |
| `containers` | List of containers in each pod |
| Container `name` | Identifier within the pod, used by commands such as `set image` |
| `image` | Packaged application to run; cloud deploy uses the full registry address |
| `env` | Name/value pairs injected at runtime |

Labels are arbitrary metadata; `run` does not execute a command. The Deployment selector must match its pod template. The image is built beforehand, not by Kubernetes from your Dockerfile.

### Readiness and shutdown

The kubelet requests the pod's `/health` endpoint on 8000. [Account](backend/account/main.py) executes `SELECT 1`, so readiness depends on database access. A running process can still be unready. Failed readiness removes normal Service traffic; it does not restart the container. Liveness/startup probes are not configured in these app manifests. [Probe behaviour](https://kubernetes.io/docs/concepts/workloads/pods/probes/)

`preStop.exec.command` runs `sleep 5` during graceful termination. This gives routing changes time to propagate before the app receives its termination signal. The hook consumes part of the default 30-second termination grace period. It cannot run on a sudden node loss and does not itself finish the application's requests. [Pod shutdown](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/)

### Service: how callers reach replicas

`---` separates two YAML documents. The Service selects pods labelled `run: account`, giving them a stable endpoint while pod IPs change. It defaults to ClusterIP because no type is specified; `targetPort` defaults to the listed `port`, 8000. A `containerPort` declaration is not required for an already listening process. Deployment and Service can share a name because they are different resource kinds. [Service reference](https://kubernetes.io/docs/concepts/services-networking/service/)

If only the Service selector became `run: accounts`, it would miss pods labelled `run: account`. Healthy pods could exist while the Service had no matching destinations.

```text
Deployment → ReplicaSet → account pod A
                       → account pod B

account Service → eligible pods labelled run=account
```

After deletion of A, the ReplicaSet creates C to restore the desired count. Scheduler chooses a node; kubelet/runtime start the container; readiness makes it eligible. The Service address remains stable. This is reconciliation of desired and observed state.

### Other backend manifests

They reuse the same pattern with their own names, images, and labels. Answer receives `SOLVER_URL` and `PROGRESS_URL`; Progress receives `ACCOUNT_URL`; Quiz receives Account, Question, Answer, and Progress URLs. Curriculum and Question primarily retrieve database data. Solver has no database environment variable and its health endpoint does not query PostgreSQL.

## 6. Frontend Kubernetes manifests

**Open:** [student.yaml](infrastructure/kubernetes/student.yaml), [developer.yaml](infrastructure/kubernetes/developer.yaml).

Each Deployment requests two Nginx pods. Readiness checks `/` on 80 because this container serves a website, rather than a FastAPI health endpoint. The Services use `type: LoadBalancer` with port 80 to request public cloud load balancer integration. The backends remain internal ClusterIP Services but selected API routes are publicly proxied through Nginx.

Two frontends × two pods plus seven backends × two pods plus one database = 19 normal application pods, before system workloads. Three worker nodes do not mean only three pods.

## 7. Database Kubernetes manifest

**Open:** [database.yaml](infrastructure/kubernetes/database.yaml).

The file defines a PVC, a Deployment, and a Service, separated by `---`.

| Field | Explanation |
|---|---|
| `kind: PersistentVolumeClaim` | Request storage independently of the pod |
| `metadata.name: database` | Claim name later referenced by the pod |
| `accessModes: ReadWriteOnce` | Read-write mounting by one node, not necessarily only one pod |
| `resources.requests.storage: 10Gi` | Requested storage capacity, not container RAM |
| Omitted `storageClassName` | Provisioning depends on the cluster's default StorageClass |
| Deployment `replicas: 1` | One PostgreSQL instance |
| `strategy.type: Recreate` | Stop old pod before creating its replacement on a Deployment update |
| `POSTGRES_DB/USER/PASSWORD` | Configure initial database/user credentials for the base image |
| `PGDATA` | Database files live in the mounted path's `pgdata` subdirectory |
| `volumeMounts` | Mount logical volume `data` at `/var/lib/postgresql/data` |
| Pod `volumes` | Define that logical volume using the PVC named `database` |
| Service port 5432 | Stable internal PostgreSQL connection endpoint |

Names connect the storage definitions: `volumeMounts.name: data` matches `volumes.name: data`; `claimName: database` points to the PVC. A PersistentVolume represents supplied storage; the claim requests it. No database health probe is configured here.

The database pod can be replaced while its files remain on storage. Startup/recovery/attachment still take time. Recreate avoids the normal update deliberately starting overlapping database instances, but does not create a complete HA design or guarantee safe manual replica changes.

Deleting a PVC can delete underlying storage according to reclaim policy. The manifest-directory delete command includes this PVC. Persistence, backups, replication, and failover are different mechanisms. [Persistent volume reference](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)

## 8. Nginx configuration

**Open:** [student nginx.conf](frontend/student/nginx.conf), [developer nginx.conf](frontend/developer/nginx.conf), [api.conf](frontend/developer/api.conf).

```nginx
location /api/account/ { proxy_pass http://account:8000/; }
```

This matches the account API prefix. With this trailing-slash configuration, `/api/account/login` is forwarded as `/login`. The `account` hostname resolves through the current environment's service discovery: Compose networking locally, Kubernetes DNS in the cluster. It does not mean the browser resolves that private hostname.

`listen 80` sets Nginx's listening port. `root` points to copied static files. `try_files $uri $uri/ /index.html` falls back to the SPA entry file so React Router can handle routes on refresh.

The student's exact `/api/progress/attempts` route returns 403 to block this public proxy path. Internal backend calls can still reach Progress; that proxy rule is not service-to-service authentication.

The developer site exposes only Answer, Curriculum, Question, and Solver under `/v1/`. Its included config strips Authorization, handles CORS/OPTIONS, and configures rate limiting. The configured rate is per Nginx instance, not one globally shared counter across both frontend pods. CORS is a browser policy, not caller authentication.

## 9. Deployment and operation commands

**Open:** [DEPLOY.md](DEPLOY.md). Read placeholders as values to replace, not literal angle-bracket syntax. Do not execute deletion commands as part of a normal update.

| Command/piece | Meaning |
|---|---|
| `gcloud config set project ...` | Choose the default Google Cloud project; does not itself switch kubectl context |
| `export REGISTRY=...` | Store an image-path prefix in this shell |
| `gcloud services enable ...` | Enable the named Google Cloud API |
| `add-iam-policy-binding ... --member=... --role=...` | Grant an identity a role on the project; actual build/node identities must be checked |
| `gcloud builds submit --tag ... backend/quiz` | Submit that context, build, and push the named image |
| `get-credentials ... --zone=...` | Configure access to the cluster at its existing location |
| `kubectl apply -f PATH` | Create/update resources from a file or directory |
| `kubectl get ...` | Summarise resource state |
| `kubectl describe ...` | Detailed configuration/state and relevant events |
| `kubectl logs ...` | Read application/container output |
| `kubectl scale deployment quiz --replicas=5` | Change desired quiz pod count; not node count |
| `kubectl delete pod POD_NAME` | Delete one pod; its controller can create a replacement |
| `kubectl set image deployment/quiz quiz=IMAGE` | Set the image of container `quiz` in that Deployment |
| `kubectl rollout status deployment/quiz` | Observe whether the rollout completes |
| `kubectl rollout undo deployment/quiz` | Restore a previous pod-template revision, not database contents |

Cloud Build and Artifact Registry handle building/storing; GKE runs workloads. Kubernetes does not need a build rerun every time you switch between existing intended images. A registry tag can be reassigned; a digest identifies particular content.

Your `sed -i` commands edit image strings in local YAML, then `apply` updates the cluster. The syntax shown is for Cloud Shell's GNU sed. `set image` changes the live object without editing the file. Keep the final image and replica count aligned with YAML so a later apply does not unexpectedly restore another configuration.

The load-balance loop repeats HTTP requests; `socket.gethostname()` in the backend response reveals the pod. `curl -s` hides progress but is weak evidence of success without status/error checks; the [practice guide](CLOUD-INTERVIEW-PRACTICE.md#7-cloud-demonstrations) has a loop with error handling.

`ImagePullBackOff` means image retrieval failed and retries are backing off. Inspect Events for wrong addresses/tags, missing registry read access, or network failure. Fix the actual cause; deleting every pod is usually unnecessary.

## 10. Explain these without reading

1. Which instructions run during a build, and which run when a container starts?
2. Why does every backend use 8000 without a port collision?
3. Why does `depends_on` not prove PostgreSQL is ready?
4. How do a label and selector connect a Service to pods?
5. Why does a deleted pod return, while its IP/name can change?
6. What does failed readiness change? What does it not do?
7. How do `volumeMounts`, `volumes`, and `claimName` connect?
8. Why do the frontends use LoadBalancer and backends use ClusterIP?
9. Why does publishing an image not update running pods?
10. What changes in a rollback, and what stays in the database?

For architecture justification and failure scenarios, return to [Follow-up questions](FOLLOW-UP-QUESTIONS.md).
