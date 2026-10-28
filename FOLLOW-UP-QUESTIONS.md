# Mathora: presentation follow-up questions and answers

These questions follow the claims and commands in [your presentation](PRESENTATION-SCRIPT.md). They are likely directions for discussion, not guaranteed tutor questions. **Practise questions 1–12 first.** Answers are phrased so you can say them aloud; use the code links when asked to go deeper.

## First priority: architecture and demonstrations

### 1. Why does Mathora need cloud computing instead of one server?

**Answer:** “Demand could rise before exams. Cloud infrastructure lets me provision capacity without purchasing hardware for peak demand. It also supports replicated deployment and managed infrastructure. My current demonstration changes replicas manually; I am not claiming that the application automatically scales with traffic.”

**If asked whether it could run locally:** “Yes. Compose runs it locally. The cloud benefit is in provisioning and operating the deployed resources, not simply using Docker.”

### 2. Why did you use microservices? Why seven?

**Answer:** “The services separate account management, curriculum, questions, marking, symbolic maths, quizzes, and progress. This lets a capability such as Solver scale independently. The tradeoff is extra network calls, configuration, and failure handling. Because the services share PostgreSQL, they are not completely independent.”

**If asked whether a monolith could scale:** “Yes, by replicating the whole application. My service boundaries allow selected capabilities to scale separately.”

**Code:** [backend services](backend/), [architecture](architecture.png).

### 3. What is the difference between Docker, Docker Compose, and Kubernetes?

**Answer:** “An image packages the application and dependencies; a container is a running instance. Docker builds and runs containers. Compose describes how my components run together locally. Kubernetes schedules and manages pods across cluster nodes, maintaining replicas and supporting service networking and rollouts.”

**If asked whether the frontend runs Node in production:** “Node builds the frontend. The final image runs Nginx to serve static files, and React executes in the browser.”

**Code:** [backend Dockerfile](backend/account/Dockerfile), [frontend Dockerfile](frontend/student/Dockerfile), [Compose](infrastructure/docker-compose.yaml).

### 4. Why do you need both a Deployment and a Service?

**Answer:** “The Deployment describes the pod template and desired replicas, using ReplicaSets to maintain them. The Service gives selected pods a stable network endpoint. Pods can be replaced and change IP, so callers use the Service name rather than selecting a pod directly.”

**If asked how the Service finds pods:** “Its selector matches labels such as `run: account`. Matching names alone do not connect the objects.”

**Code:** [account.yaml](infrastructure/kubernetes/account.yaml).

### 5. Walk me through a request from the browser to your backend.

**Answer:** “The browser requests the public frontend endpoint. The cloud load balancer forwards toward Nginx, which routes the API path to an internal Kubernetes Service. Service networking directs the connection to a ready backend pod. That service performs its work and may query PostgreSQL or call another service.”

**If asked for the actual login route:** “Nginx forwards `/api/account/login` to `/login` at `account:8000`. The browser does not resolve the internal name `account`.”

**Code:** [student Nginx routes](frontend/student/nginx.conf), [Account](backend/account/main.py).

### 6. You scaled Quiz to five. Did you create five servers? Why five?

**Answer:** “No. I requested five quiz pods on the existing worker nodes. Five is a demonstration target that makes the replica change visible, not a measured optimal count. Kubernetes needs enough existing node capacity to schedule the additional pods.”

**If asked whether performance increased fivefold:** “I have not established that. I would load-test real quiz requests and measure throughput, errors, latency, and database pressure.”

**If asked how many pods normally run:** “The manifests request nineteen application pods: two per frontend/backend and one database. There are ten component/image types; cluster system pods are additional.”

**Code:** `kubectl scale deployment quiz --replicas=5`; [quiz.yaml](infrastructure/kubernetes/quiz.yaml).

### 7. What exactly replaces the pod you delete?

**Answer:** “The ReplicaSet sees fewer pods than requested and creates a replacement. The scheduler assigns it to a node; kubelet and the runtime start the container. Once ready, it becomes eligible for Service traffic. I do not manually create the replacement.”

**If asked why users can still access the application:** “Other ready replicas can receive traffic. I check requests during replacement, but this does not guarantee every in-flight request survives or prove resilience to every node failure.”

**Code:** Quiz's `replicas`, `template`, and `selector` in [quiz.yaml](infrastructure/kubernetes/quiz.yaml).

### 8. How do you know a new pod is ready? Does a failed health check restart it?

**Answer:** “The readiness probe requests `/health` on port 8000. For database-using backends, that endpoint executes a simple database query. A failed readiness check removes normal Service traffic; it does not itself restart the container. Liveness probes, which I have not configured, can trigger restarts.”

**If asked why a Running pod can be unready:** “The process can be running while the database is unavailable or the health request fails.”

**Code:** [account.yaml](infrastructure/kubernetes/account.yaml), `health` in [Account](backend/account/main.py).

### 9. Where is load balancing, and what do the changing pod names prove?

**Answer:** “The frontend LoadBalancer Service provides public cloud load balancer integration. Nginx routes API paths, and internal Service networking distributes connections to eligible backend pods. The root response includes the hostname. Different pod names show requests reaching multiple replicas through one public endpoint.”

**If asked which algorithm you configured:** “These manifests do not explicitly select a round-robin policy. Behaviour depends on the networking implementation and connection reuse, so I do not promise exact alternation.”

**If asked Layer 4 versus Layer 7:** “Layer 4 works with connections and ports; Layer 7 can inspect HTTP details such as paths. My Nginx routes use HTTP paths.”

**Code:** [student Service](infrastructure/kubernetes/student.yaml), `root` in [Quiz](backend/quiz/main.py).

### 10. How does your rolling update work? What actually changed in v2?

**Answer:** “Changing the image changes the Deployment's pod template. It manages a new ReplicaSet and gradually replaces replicas, using readiness before new pods receive normal traffic. If v2 was built from unchanged source, this demonstrates an image-version rollout rather than a new feature.”

**If asked whether an image push is enough:** “No. The Deployment must request the intended image. My `set image` command triggers that change.”

**If asked about compatibility:** “Old and new replicas can coexist during a rollout, so both must work with the APIs and database schema in use.”

**Code:** `kubectl set image deployment/quiz quiz=...`; [quiz.yaml](infrastructure/kubernetes/quiz.yaml).

### 11. Is explicitly setting v1 really a rollback? Does it undo everything?

**Answer:** “It is an application-image rollback: I explicitly restore v1 and wait for its rollout to complete. It does not reverse database writes or migrations. The v2 image and rollout history also remain. Repeatedly choosing v1 and v2 makes rehearsal predictable.”

**If asked about `rollout undo`:** “It restores a previous pod-template revision, which is not necessarily v1. My explicit image command changes the live Deployment, not the local YAML.”

**Code:** update/rollback commands in [the script](PRESENTATION-SCRIPT.md).

### 12. How does the data survive deleting or replacing a database pod?

**Answer:** “PostgreSQL's data directory is mounted from storage requested by a PVC. The storage is managed separately from the replaceable container. A replacement can use the same database files if storage is available and attachment constraints permit. PostgreSQL still needs to start and recover; persistence does not mean uninterrupted availability.”

**If asked whether you can delete everything safely:** “No. Deleting the PVC can delete underlying storage depending on reclaim policy. I demonstrate application pod deletion, not database or storage deletion.”

**Code:** `volumeMounts`, `volumes`, and `claimName` in [database.yaml](infrastructure/kubernetes/database.yaml).

## Feature questions: follow the actual service calls

### 13. Why can a user stay logged in after an account pod disappears?

**Answer:** “The browser holds a random session token, and PostgreSQL stores its hash, user ID, and expiry. Another account replica can validate the same token against that shared record. Sessions do not depend on one pod's memory, so sticky sessions are unnecessary for this design.”

**If asked whether it is a JWT:** “No. It is an opaque random token whose meaning is looked up in the database.”

**Code:** `login` and `me` in [Account](backend/account/main.py), [frontend token handling](frontend/student/src/api.ts).

### 14. How are passwords protected? How do you stop users viewing another user's quiz?

**Answer:** “Passwords use scrypt with random salts, and verification compares derived hashes rather than decrypting a stored password. Authentication identifies the caller through a session. Authorisation then checks ownership: Quiz only returns a quiz belonging to that user.”

**If asked why session tokens use SHA-256 instead of scrypt:** “The tokens are high-entropy random values, unlike guessable human-chosen passwords. They serve different purposes.”

**Code:** `hash_password` in [Account](backend/account/main.py), `owned_quiz` in [Quiz](backend/quiz/main.py).

### 15. How does a practice answer get checked and saved?

**Answer:** “The frontend obtains questions through Question and submits an answer to Answer. Answer reads the expected answer from PostgreSQL, calls Solver for symbolic comparisons where required, and returns correctness. For logged-in practice it asks Progress to record attempts; Progress validates identity through Account.”

**If asked what happens when progress recording fails:** “Marking can still return a result with `recorded: false`. The student received feedback, but that attempt was not confirmed as recorded.”

**Code:** [practice frontend](frontend/student/src/pages/PracticeSession.tsx), `mark` and `record` in [Answer](backend/answer/main.py).

### 16. Why do you need separate Answer and Solver services?

**Answer:** “Answer handles question-specific marking rules and requests recording. Solver provides general symbolic operations such as simplification and equivalence. Keeping these separate allows reuse and independent scaling of symbolic work, but adds a dependency and network call when Answer needs Solver.”

**If asked whether equivalent expressions are always accepted:** “The required answer form matters too. A question may require an expanded or factored form, not just mathematical equivalence.”

**Code:** `same_expression` and `is_correct` in [Answer](backend/answer/main.py), [Solver](backend/solver/main.py).

### 17. Explain quiz creation and submission across the services.

**Answer:** “Quiz validates identity through Account, gets questions through Question, and stores the quiz plus question snapshots. Submission calls Answer for marking, potentially involving Solver. Quiz commits results, then calls Progress to record answered questions. The saved result can be retrieved later.”

**If asked why snapshots are stored:** “The quiz stores the selected question content in JSONB so it can display that saved content later. That does not mean every marking input is fully versioned; marking reads the expected answer from the questions table.”

**Code:** `create_quiz` and `submit_quiz` in [Quiz](backend/quiz/main.py), [schema](database/schema.sql).

### 18. What if two requests submit the same quiz at once?

**Answer:** “Both could initially observe an unsubmitted quiz. The later database update includes `submitted_at IS NULL` and returns the claimed row. Only one competing transaction can successfully claim it; the other returns a conflict. That coordinates across replicas, unlike an in-memory Python lock.”

**If asked whether this prevents every duplicate side effect:** “It protects the submission claim. It does not make the later HTTP delivery to Progress part of the same transaction.”

**Code:** conditional `UPDATE` in `submit_quiz`, [Quiz](backend/quiz/main.py).

### 19. What if Quiz saves successfully but Progress is unavailable?

**Answer:** “The quiz transaction can already be committed before the Progress request fails. The user may see an error while the quiz remains submitted. Retrying may then return ‘already submitted.’ A proposed outbox could store a delivery event with the result, then retry delivery with idempotent processing.”

**If asked what idempotent means:** “Repeated delivery has the same intended effect as one delivery, rather than inserting duplicate attempts.”

**Code:** database transaction followed by `progress.post` in [Quiz](backend/quiz/main.py).

### 20. How does Progress decide what to recommend? Is it AI?

**Answer:** “It is rule-based SQL, not a trained model. It identifies weaker topics from saved attempts and accuracy, then suitable untried topics. Progress checks identity through Account and queries the user's records. This turns stored answers into targeted practice suggestions.”

**If asked about the actual thresholds:** “The current constants use at least three attempts and accuracy below 70 percent for weak-topic recommendations.”

**Code:** `recommendations`, `MIN_ATTEMPTS`, and `TARGET_ACCURACY` in [Progress](backend/progress/main.py).

## Limitations and solutions: defend your closing claims

### 21. Why PostgreSQL instead of NoSQL? Why a shared database?

**Answer:** “The data has relationships between users, quizzes, questions, and attempts, so joins, foreign keys, constraints, and transactions fit the application. Sharing one database simplifies this assignment, but couples services through schema and capacity. Separate databases could strengthen boundaries but complicate cross-service data access and consistency.”

**Code:** [schema.sql](database/schema.sql), backend `DATABASE_URL` values in [the manifests](infrastructure/kubernetes/).

### 22. You mentioned failover and backups. Are they the same thing?

**Answer:** “No. Replication maintains additional database copies; failover switches service to another instance after a failure. Backups recover an earlier copy after loss or corruption. Replication may also copy an accidental deletion, so it does not replace backups. A restore needs testing to establish recoverability.”

**If asked what is configured now:** “One PostgreSQL instance and persistent storage. Automated failover and backups are not configured in the repository.”

### 23. Why not scale the database to two pods, like Quiz?

**Answer:** “Extra PostgreSQL pods do not automatically establish safe replication, leadership, or failover. They must not simply write to the same database directory. The existing one-instance Deployment uses Recreate; a proper database HA design would need additional configuration or a suitably configured managed service.”

**If asked about StatefulSet:** “It provides stable identities and storage conventions, not PostgreSQL replication by itself.”

**Code:** `replicas: 1`, `Recreate`, and the shared PVC in [database.yaml](infrastructure/kubernetes/database.yaml).

### 24. Why does one zone matter if you have several replicas?

**Answer:** “Replicas in the same zone can be affected by the same zone outage. I would distribute nodes and application replicas across zones, use deliberate placement rules, and make the database/storage resilient too. A regional control plane alone would not protect a single-zone database.”

**If asked whether replicas are guaranteed to be on different nodes now:** “These manifests do not explicitly guarantee that. I would inspect live placement and add topology-spread or anti-affinity rules where needed.”

### 25. Why manual scaling? How would you make it automatic?

**Answer:** “Manual scaling demonstrates that the service can change replica count. An HPA could adjust pods using metrics; node autoscaling could add capacity when scheduling requires it. I would first define resource requests, measure demand, and choose a scaling signal and bounds. Neither automatic mechanism is established by these files.”

**If asked about requests and limits:** “Requests guide scheduling/accounting; limits constrain resource use. The app manifests do not explicitly set CPU/memory requests and limits.”

### 26. What if extra pods stay Pending or the app remains slow?

**Answer:** “For Pending pods I would inspect events for insufficient capacity, placement constraints, or storage issues. For slowness I would measure CPU, request latency, downstream calls, queries, and database connections. More pods can increase database pressure rather than fix it.”

**If asked about connection pools:** “They reuse connections, but each added process or pod can have its own pool. Total potential connections increase with replicas.”

**Commands to explain:** `kubectl describe pod POD_NAME`, `kubectl logs POD_NAME`, `kubectl get pods -o wide`.

### 27. What would you do if a pod cannot pull the image or keeps crashing?

**Answer:** “ImagePullBackOff points to retrieval problems: wrong image/tag, registry access, or networking. I inspect pod Events and the actual node identity's image-read permissions. CrashLoopBackOff means the started process repeatedly exits, so I inspect current and previous logs for configuration or application errors.”

**If asked whether the build succeeding proves pull access:** “No. Cloud Build's upload identity can differ from the node's download identity.”

**Commands to explain:** `kubectl describe pod POD_NAME`, `kubectl logs POD_NAME --previous`.

### 28. Why do you need HTTPS and secret management? Is the private network enough?

**Answer:** “The public examples use HTTP and credentials are embedded in YAML. HTTPS protects traffic in transit; controlled secret delivery reduces exposure and supports rotation. Internal reachability does not prove caller identity. Application authorisation and appropriate permissions remain necessary.”

**If asked whether Secrets are encrypted because of base64:** “Base64 is encoding, not encryption. Access control and storage encryption configuration still matter.”

**If asked about CORS:** “It controls browser cross-origin behaviour; it is not authentication and does not block every non-browser client.”

### 29. Are two frontends and Kubernetes worth their cost?

**Answer:** “They support separate interfaces and demonstrate orchestration and independent service management, but introduce resource and operational overhead. I would compare that cost with the application's needs. The proposal estimated approximately A$606 per month continuously; that is the submitted estimate, not a current quote or measured bill.”

**If asked whether pausing nodes stops all charges:** “No. Disks, load balancers, and other retained resources may remain billable.”

**If asked whether rate limiting is global:** “The developer Nginx instances do not share one global counter. Adding replicas affects the combined limit.”

### 30. What would you improve first, and how would you verify it?

**Answer:** “I would protect credentials and traffic, establish backups with a tested restore, and improve database and zone availability according to recovery needs and budget. I would measure real workflows before selecting autoscaling or performance changes. Each proposed improvement needs evidence, not just extra replicas or a new configuration label.”

**If asked what to measure:** “Errors, latency, throughput, resource use, database health, and successful recovery of real user workflows. The root request loop alone is not a full load test.”

## Two-minute rehearsal

Choose one question from 1–5, one from 6–12, and one from 13–30. Answer each in about 30 seconds, leaving time for clarification. Use the first answer paragraph; expand only if asked.

If unsure, say: “I understand this part as ____. I am not certain about ____. I would check ____.” You can offer to open the YAML or function and reason through it. Do not invent a benchmark, automatic feature, or completed improvement.

For line-by-line syntax, use [Cloud code explained](CLOUD-CODE-EXPLAINED.md). For broader course concepts, use [the study workbook](CLOUD-INTERVIEW-PRACTICE.md).
