import 'katex/dist/katex.min.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, Route, Routes } from 'react-router'
import { AuthProvider } from './components/AuthProvider'
import { Layout } from './components/Layout'
import { RequireAuth } from './components/RequireAuth'
import { button, Empty } from './components/ui'
import './index.css'
import { Curriculum, CurriculumCourse, CurriculumTopic } from './pages/Curriculum'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { PracticeCourses, PracticeTopics } from './pages/Practice'
import { PracticeSession } from './pages/PracticeSession'
import { Progress } from './pages/Progress'
import { Quiz } from './pages/Quiz'
import { Quizzes } from './pages/Quizzes'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="login" element={<Login mode="login" />} />
            <Route path="register" element={<Login mode="register" />} />
            <Route path="practice" element={<PracticeCourses />} />
            <Route path="practice/:course" element={<PracticeTopics />} />
            <Route path="practice/topic/:topicId" element={<PracticeSession />} />
            <Route path="quizzes" element={<RequireAuth><Quizzes /></RequireAuth>} />
            <Route path="quizzes/:id" element={<RequireAuth><Quiz /></RequireAuth>} />
            <Route path="progress" element={<RequireAuth><Progress /></RequireAuth>} />
            <Route path="curriculum" element={<Curriculum />} />
            <Route path="curriculum/courses/:id" element={<CurriculumCourse />} />
            <Route path="curriculum/topics/:id" element={<CurriculumTopic />} />
            <Route
              path="*"
              element={
                <Empty title="Page not found">
                  <Link to="/" className={`${button} mt-2`}>
                    Go home
                  </Link>
                </Empty>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
