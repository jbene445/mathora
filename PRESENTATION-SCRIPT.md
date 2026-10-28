# Mathora

Basic spoken script. Italic lines are demonstration cues. Rehearse within four minutes, including clicks and rollout waits. Study [follow-up questions](FOLLOW-UP-QUESTIONS.md) and [cloud code explained](CLOUD-CODE-EXPLAINED.md) separately.

**Prepare before the presentation — Cloud Shell, from the repository root.** These commands assume the application is already deployed. Replace `PROJECT_ID` with your project ID. Use your actual cluster name/zone if they differ from the deployment guide.

```bash
# Select the Google Cloud project containing the cluster and images.
gcloud config set project PROJECT_ID

# Connect kubectl to the existing cluster; --zone identifies its location.
gcloud container clusters get-credentials mathora-cluster --zone=australia-southeast1-b

# Confirm which cluster kubectl will operate on.
kubectl config current-context

# Show cloud endpoints; -o wide also includes the Deployment's image reference.
kubectl get svc
kubectl get deployment quiz -o wide

# Replace PROJECT_ID; export makes REGISTRY available in this terminal.
export REGISTRY="australia-southeast1-docker.pkg.dev/PROJECT_ID/mathora"
```

Start with two ready Quiz replicas on v1. Both v1 and v2 images must exist. If the intended v2 is not built yet, run this **before** the timed presentation; skip it when reusing that image:

```bash
# Build from backend/quiz and push the image named by --tag.
gcloud builds submit --tag "$REGISTRY/mathora-quiz:v2" backend/quiz
```

## Purpose

My project is Mathora, a mathematics learning platform aligned with the Australian Curriculum and Queensland senior syllabuses. Students can practise specific topics, receive immediate feedback, and track their progress. Developers can integrate its questions and answer checking into their applications, reducing the work needed to build these features themselves.

## Architecture

Mathora has two React frontends, one for students and one for developers. Nginx serves each website and forwards API requests to seven FastAPI backend services.

I separated the services so capabilities such as symbolic maths can be scaled independently. Docker packages each component with its dependencies, and Kubernetes on Google Kubernetes Engine manages replicas, recovery, and updates.

PostgreSQL stores related users, questions, quizzes, and attempts. Persistent storage preserves database files across pod replacement.

Cloud infrastructure allows capacity to be added for changing demand without purchasing physical servers. My demonstration uses manual scaling.

## Four Features

*Show each feature briefly in the cloud application.*

1. **Accounts:** Account checks login details against PostgreSQL and creates a session for personalised access.
2. **Practice:** Question supplies questions; Answer checks submissions and uses Solver for symbolic mathematics when needed.
3. **Quizzes:** Quiz coordinates question retrieval and marking, saves results, and requests progress recording.
4. **Progress:** Progress retrieves the student's attempts and calculates accuracy and topic recommendations.

## Demonstration

*Terminal 1 runs the change commands below. In Terminal 2, start this request loop first. Replace `STUDENT_EXTERNAL_IP` with the student Service's external IP shown by `kubectl get svc`. Keep it running through scaling, recovery, and updates.*

```bash
# Set the public student endpoint in Terminal 2.
export STUDENT_URL="http://STUDENT_EXTERNAL_IP"

# Repeat requests until Ctrl-C; each successful response includes the quiz pod name.
# --fail detects HTTP errors, --silent hides progress, --show-error retains errors,
# and --max-time limits each request to five seconds. Sleep one second between calls.
while true; do
  curl --fail --silent --show-error --max-time 5 \
    "$STUDENT_URL/api/quiz/" || echo 'REQUEST FAILED'
  echo
  sleep 1
done
```

*Show actual responses. If a request fails, investigate rather than claiming uninterrupted service.*

**Scaling:** To represent increased quiz demand before exams, I increase Quiz from two to five replicas.

```bash
# Terminal 1: set the desired quiz replica count to five.
kubectl scale deployment quiz --replicas=5

# Wait for the Deployment to complete the change.
kubectl rollout status deployment/quiz

# Confirm READY shows 5/5 after successful scaling.
kubectl get deployment quiz
```

**Recovery:** I delete one quiz pod to simulate instance loss. Kubernetes creates a replacement while other ready replicas can serve requests.

```bash
# List quiz pods only; -l selects pods with the run=quiz label.
kubectl get pods -l run=quiz

# Replace QUIZ_POD_NAME with one name from that list; delete that pod only.
kubectl delete pod QUIZ_POD_NAME

# Watch the replacement become Ready; Ctrl-C stops watching, not the application.
kubectl get pods -l run=quiz --watch
```

**Load balancing:** Different responding pod names show requests reaching multiple replicas through one endpoint.

*Point to Terminal 2: its running loop is the load-balancing demonstration. Compare the `pod` values. Different names are evidence of distribution; exact alternating order is not required.*

**Update:** A bug fix would need a controlled release. I deploy v2 using a rolling update while other ready replicas remain available.

```bash
# Set container quiz in Deployment quiz to the prebuilt v2 image.
kubectl set image deployment/quiz quiz="$REGISTRY/mathora-quiz:v2"

# Wait until the rolling update completes.
kubectl rollout status deployment/quiz

# Inspect the image reference and replica state; confirm the image ends in :v2.
kubectl describe deployment quiz
```

**Rollback:** If a release caused problems, I could restore an earlier image. I return to v1; this does not reverse database changes.

```bash
# Explicitly restore the v1 image, making repeated practice predictable.
kubectl set image deployment/quiz quiz="$REGISTRY/mathora-quiz:v1"

# Wait until the return to v1 completes.
kubectl rollout status deployment/quiz

# Confirm the image ends in :v1 and the replicas are available.
kubectl describe deployment quiz
```

*After the demonstrations, return to the normal replica count and stop Terminal 2's request loop with Ctrl-C.*

```bash
# Restore the normal desired quiz replica count of two.
kubectl scale deployment quiz --replicas=2

# Wait and verify READY shows 2/2.
kubectl rollout status deployment/quiz
kubectl get deployment quiz
```

*These version commands change the live Deployment without editing YAML. The normal manifest should still specify v1 and two replicas. A later apply uses the values in that file.*

## Limitations and Solutions

The database has one instance, so it remains a common failure point. Database failover and tested backups would improve availability and recovery.

The documented cluster also uses one zone. Distributing replicas and suitable database storage across zones would improve resilience.

I would also add HTTPS and secret management. These improvements add cost and complexity, so I would prioritise data protection, then measure demand before configuring autoscaling.

---

Before the presentation, build the intended v2 image and prepare a small quiz. If v2 contains unchanged code, describe the demonstration as an image-version rollout. After rehearsal, restore two ready quiz replicas on v1.
