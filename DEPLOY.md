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
# Set project
gcloud config set project <project_id>
# Clone repo
git clone https://github.com/jbene445/mathora.git && cd mathora
# Set registry address
export REGISTRY="australia-southeast1-docker.pkg.dev/<project_id>/mathora"
# Allow docker to push to the registry
gcloud auth configure-docker australia-southeast1-docker.pkg.dev
```

Build:

```bash
# Build image: -t name:version, then folder
# Push image to the registry
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
# Use registry images in Kubernetes files
sed -i "s|image: mathora-|image: $REGISTRY/mathora-|" infrastructure/kubernetes/*.yaml
```

Deploy:

```bash
# Connect kubectl to the cluster
gcloud container clusters get-credentials mathora-cluster --zone=australia-southeast1-a
# Create everything in the folder
kubectl apply -f infrastructure/kubernetes/
# Show pods
kubectl get pods
# Show services and EXTERNAL-IP
kubectl get svc
```

- frontend/student: http://<student_ip>
- frontend/developer: http://<developer_ip>

ImagePullBackOff (Console):

- IAM & Admin → IAM: add Artifact Registry Reader to `<project_number>-compute@developer.gserviceaccount.com`

```bash
# Recreate pods to pull images again
kubectl delete pods --all
```

Scale:

```bash
# Scale quiz to 5 pods
kubectl scale deployment quiz --replicas 5
# Show ready pods
kubectl get deployment
```

Delete pod:

```bash
# Delete pod
kubectl delete pod <quiz_pod_name>
# Show replacement pod
kubectl get pods
```

Load balance:

```bash
# Send 8 requests, each shows the pod
for i in {1..8}
do
  curl -s http://<student_ip>/api/quiz/
  echo
done
```

Update:

```bash
# Build and push quiz v2
docker build -t $REGISTRY/mathora-quiz:v2 backend/quiz
docker push $REGISTRY/mathora-quiz:v2
# Use v2
sed -i "s|mathora-quiz:v1|mathora-quiz:v2|" infrastructure/kubernetes/quiz.yaml
# Rolling update
kubectl apply -f infrastructure/kubernetes/quiz.yaml
# Show image
kubectl describe deployment quiz
```

Rollback:

```bash
# Use v1
sed -i "s|mathora-quiz:v2|mathora-quiz:v1|" infrastructure/kubernetes/quiz.yaml
# Rollback
kubectl apply -f infrastructure/kubernetes/quiz.yaml
```

Pause:

```bash
# Resize to 0 nodes
gcloud container clusters resize mathora-cluster --num-nodes=0 --zone australia-southeast1-a
```

Resume:

```bash
# Resize to 3 nodes
gcloud container clusters resize mathora-cluster --num-nodes=3 --zone australia-southeast1-a
```

Delete:

```bash
# Delete everything in the folder
kubectl delete -f infrastructure/kubernetes/
```

Delete (Console):

- cluster: `mathora-cluster`
- repository: `mathora`
