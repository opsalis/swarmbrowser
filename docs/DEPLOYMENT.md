# Deployment Guide — SwarmBrowser

## Prerequisites

- k3s cluster with nodes in multiple regions
- kubectl configured
- Docker for building images
- Nodes with at least 2GB RAM per SwarmBrowser pod

## 1. Build Docker Image

```bash
cd backend
docker build -t opsalis/swarmbrowser:latest .
docker push opsalis/swarmbrowser:latest
```

Note: The image is ~400MB due to Chromium. Build time is longer than other services.

## 2. Deploy

```bash
# Create namespace and service
kubectl apply -f backend/k8s/service.yaml

# Deploy browser pods
kubectl apply -f backend/k8s/deployment.yaml

# Enable autoscaling
kubectl apply -f backend/k8s/hpa.yaml
```

## 3. Create Secrets

```bash
kubectl create secret generic swarmbrowser-secrets -n swarmbrowser \
  --from-literal=api-key=YOUR_API_KEY
```

## 4. Verify

```bash
kubectl get pods -n swarmbrowser
kubectl port-forward -n swarmbrowser svc/swarmbrowser 3500:3500

# Health check
curl http://localhost:3500/health

# Test screenshot
curl -X POST http://localhost:3500/v1/screenshot \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://example.com"}' \
  --output test.png
```

## 5. Pod Distribution

The deployment creates 4 replicas (one per node by default). The pod topology spread ensures geographic distribution:

```bash
kubectl get pods -n swarmbrowser -o wide
```

## 6. Autoscaling

The HPA scales from 4 to 40 pods based on CPU (70%) and memory (80%):

```bash
kubectl get hpa -n swarmbrowser
```

Scale-up is aggressive (4 pods per minute) to handle burst traffic.
Scale-down is conservative (5-minute stabilization) to avoid thrashing.

## 7. Resource Tuning

Each pod runs 5 browser instances by default. Adjust via environment:

| POOL_SIZE | Memory Needed | Best For |
|-----------|---------------|----------|
| 3 | ~1GB | Resource-constrained nodes |
| 5 | ~1.5GB | Default — good balance |
| 10 | ~3GB | High-throughput nodes |

## 8. Website

```bash
cd website
npx wrangler pages deploy . --project-name=swarmbrowser-website
```

## Troubleshooting

### Chrome crashes
- Check `/dev/shm` size (needs emptyDir with Memory medium in pod spec)
- Increase memory limits
- Reduce POOL_SIZE

### Slow page loads
- Enable resource blocking (`blockResources: ["image", "font"]`)
- Reduce timeout
- Check node network connectivity

### Out of memory
- Reduce POOL_SIZE
- Lower MAX_USES to recycle browsers more often
- Check for memory leaks in long-running pods
