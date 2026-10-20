# Deploy (Visual)

Create cluster (Console):

- Kubernetes Engine → Clusters → Create → Standard: Configure
- Cluster basics:
  - name: `mathora-cluster`
  - location type: Zonal
  - zone: `australia-southeast1-a`

![Cluster basics](images/console-cluster-basics.png)

- default-pool:
  - number of nodes: 3

![Node pool](images/console-node-pool.png)

- default-pool → Nodes:
  - image type: Ubuntu with containerd
  - machine type: `n1-standard-2`
  - boot disk: Balanced persistent disk, 50 GB
- Create

![Nodes](images/console-nodes.png)

Create repository (Console):

- Artifact Registry → Repositories → Create repository
  - name: `mathora`
  - format: Docker
  - location type: Region, `australia-southeast1`
- Create

![Repository](images/console-repository.png)

Setup (Cloud Shell):

- Activate Cloud Shell (top right)
- Run Setup

![Cloud Shell](images/cloud-shell.png)

Build (Cloud Shell):

- Run Build
- Artifact Registry → `mathora`: 10 images

![Images](images/console-images.png)

Deploy (Cloud Shell):

- Run Deploy
- Kubernetes Engine → Workloads: all OK

![Workloads](images/console-workloads.png)

- Kubernetes Engine → Gateways, Services & Ingress → Services: `student` and `developer` endpoints

![Services](images/console-services.png)

- frontend/student: http://<student_ip>

![Student site](images/site-student.png)

- frontend/developer: http://<developer_ip>

![Developer site](images/site-developer.png)

ImagePullBackOff (Console):

- IAM & Admin → IAM → Grant access
  - principal: `<project_number>-compute@developer.gserviceaccount.com`
  - role: Artifact Registry Reader
- Run ImagePullBackOff (Cloud Shell)

![IAM](images/console-iam.png)

Scale (Console):

- Workloads → `quiz` → Actions → Scale → Edit replicas: 5

![Scale](images/console-scale.png)

Delete pod (Console):

- Workloads → `quiz` → Managed pods → pod → Delete
- Workloads → `quiz` → Managed pods: new pod replaces it

![Delete pod](images/console-delete-pod.png)

Load balance (Cloud Shell):

- Run Load balance: different `pod` names

![Load balance output](images/shell-load-balance.png)

Update and rollback (Cloud Shell):

- Run Update
- Workloads → `quiz` → Revision history: v2

![Update](images/console-update.png)

- Run Rollback
- Workloads → `quiz` → Revision history: v1

![Rollback](images/console-rollback.png)

Pause and resume (Console):

- Clusters → `mathora-cluster` → Nodes → `default-pool` → Resize
  - pause: 0
  - resume: 3

![Resize](images/console-resize.png)

Delete:

- Run Delete (Cloud Shell)
- Kubernetes Engine → Clusters → `mathora-cluster` → Delete
- Artifact Registry → Repositories → `mathora` → Delete

Screenshots (save to `images/`):

- console-cluster-basics.png
- console-node-pool.png
- console-nodes.png
- console-repository.png
- cloud-shell.png
- console-images.png
- console-workloads.png
- console-services.png
- site-student.png
- site-developer.png
- console-iam.png
- console-scale.png
- console-delete-pod.png
- shell-load-balance.png
- console-update.png
- console-rollback.png
- console-resize.png
