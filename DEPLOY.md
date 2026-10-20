# Deploy

Create (Console):

- Kubernetes Engine cluster:
  - name: `mathora-cluster`
  - mode: Standard
  - zone: `australia-southeast1-a`
  - nodes: 3
  - machine: `n1-standard-2`
  - image: Ubuntu with containerd
  - disk: 50 GB balanced
- Artifact Registry repository:
  - name: `mathora`
  - format: Docker
  - region: `australia-southeast1`

Setup (Cloud Shell):

```bash
gcloud config set project <project_id>
git clone https://github.com/jbene445/mathora.git && cd mathora
export REGISTRY="australia-southeast1-docker.pkg.dev/<project_id>/mathora"
gcloud auth configure-docker australia-southeast1-docker.pkg.dev
```

Build:

```bash
docker build -t $REGISTRY/mathora-account:v1 backend/account
docker push $REGISTRY/mathora-account:v1
docker build -t $REGISTRY/mathora-answer:v1 backend/answer
docker push $REGISTRY/mathora-answer:v1
docker build -t $REGISTRY/mathora-curriculum:v1 backend/curriculum
docker push $REGISTRY/mathora-curriculum:v1
docker build -t $REGISTRY/mathora-progress:v1 backend/progress
docker push $REGISTRY/mathora-progress:v1
docker build -t $REGISTRY/mathora-question:v1 backend/question
docker push $REGISTRY/mathora-question:v1
docker build -t $REGISTRY/mathora-quiz:v1 backend/quiz
docker push $REGISTRY/mathora-quiz:v1
docker build -t $REGISTRY/mathora-solver:v1 backend/solver
docker push $REGISTRY/mathora-solver:v1
docker build -t $REGISTRY/mathora-developer:v1 frontend/developer
docker push $REGISTRY/mathora-developer:v1
docker build -t $REGISTRY/mathora-student:v1 frontend/student
docker push $REGISTRY/mathora-student:v1
docker build -t $REGISTRY/mathora-database:v1 database
docker push $REGISTRY/mathora-database:v1
sed -i "s|image: mathora-|image: $REGISTRY/mathora-|" infrastructure/kubernetes/*.yaml
```

Deploy:

```bash
gcloud container clusters get-credentials mathora-cluster --zone=australia-southeast1-a
kubectl apply -f infrastructure/kubernetes/
kubectl get pods
kubectl get svc
```

- frontend/student: http://<student_ip>
- frontend/developer: http://<developer_ip>

ImagePullBackOff (Console):

- IAM & Admin → IAM: add Artifact Registry Reader to `<project_number>-compute@developer.gserviceaccount.com`

```bash
kubectl delete pods --all
```

Scale:

```bash
kubectl scale deployment quiz --replicas 5
kubectl get deployment
```

Delete pod:

```bash
kubectl delete pod <quiz_pod_name>
kubectl get pods
```

Load balance:

```bash
for i in {1..8}
do
  curl -s http://<student_ip>/api/quiz/
  echo
done
```

Update:

```bash
docker build -t $REGISTRY/mathora-quiz:v2 backend/quiz
docker push $REGISTRY/mathora-quiz:v2
sed -i "s|mathora-quiz:v1|mathora-quiz:v2|" infrastructure/kubernetes/quiz.yaml
kubectl apply -f infrastructure/kubernetes/quiz.yaml
kubectl describe deployment quiz
```

Rollback:

```bash
sed -i "s|mathora-quiz:v2|mathora-quiz:v1|" infrastructure/kubernetes/quiz.yaml
kubectl apply -f infrastructure/kubernetes/quiz.yaml
```

Pause:

```bash
gcloud container clusters resize mathora-cluster --num-nodes=0 --zone australia-southeast1-a
```

Resume:

```bash
gcloud container clusters resize mathora-cluster --num-nodes=3 --zone australia-southeast1-a
```

Delete:

```bash
kubectl delete -f infrastructure/kubernetes/
```

Delete (Console):

- cluster: `mathora-cluster`
- repository: `mathora`
