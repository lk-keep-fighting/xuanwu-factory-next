# Real-World Example: Multi-Debug-Tools Deployment

## Scenario: Debugging a Microservice

A developer needs to debug a Node.js microservice that has both application logic issues and network connectivity problems. They need:
- Basic shell tools (BusyBox)
- Network diagnostic tools (Netshoot)

## Step 1: Configure Debug Tools in UI

The developer opens the service configuration page and selects debug tools:

```
┌─────────────────────────────────────────────────────────┐
│ Debug Tools Configuration                               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Quick Presets: [Basic] [Network] [Full]                │
│                                                         │
│ ☑ BusyBox                                               │
│   Path: /debug-tools/busybox                            │
│   Size: ~2MB | Tools: sh, ls, cat, grep, ps, top...    │
│                                                         │
│ ☑ Netshoot                                              │
│   Path: /debug-tools/netshoot                           │
│   Size: ~50MB | Tools: curl, wget, dig, tcpdump...     │
│                                                         │
│ ☐ Ubuntu                                                │
│   Path: /debug-tools/ubuntu                             │
│   Size: ~100MB | Tools: bash, apt, systemd tools...    │
│                                                         │
│ ☐ Custom Image                                          │
│   Path: /debug-tools/custom                             │
│   Image: [                                    ]         │
│                                                         │
│ [Save Configuration]                                    │
└─────────────────────────────────────────────────────────┘
```

## Step 2: Configuration Saved to Database

```json
{
  "id": "service-123",
  "name": "payment-api",
  "type": "APPLICATION",
  "image": "myregistry.com/payment-api:v1.2.3",
  "debug_config": {
    "enabled": true,
    "tools": [
      {
        "toolset": "busybox",
        "mountPath": "/debug-tools/busybox"
      },
      {
        "toolset": "netshoot",
        "mountPath": "/debug-tools/netshoot"
      }
    ]
  }
}
```

## Step 3: Deploy Service

Developer clicks "Deploy" button. The system:

1. Reads the service configuration
2. Calls `k8sService.deployService(service, namespace)`
3. Normalizes the debug config
4. Generates Init Containers and Volumes
5. Creates Kubernetes Deployment

## Step 4: Generated Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payment-api
  namespace: production
  labels:
    app: payment-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: payment-api
  template:
    metadata:
      labels:
        app: payment-api
    spec:
      # Debug Tools Init Containers
      initContainers:
        # BusyBox Init Container
        - name: debug-tools-busybox
          image: busybox:latest
          imagePullPolicy: IfNotPresent
          command: ['sh', '-c']
          args:
            - |
              echo "Installing BusyBox debug tools..."
              cp /bin/busybox /debug-tools/busybox/
              /debug-tools/busybox/busybox --install -s /debug-tools/busybox/
              echo "BusyBox tools installed successfully at /debug-tools/busybox"
              ls -la /debug-tools/busybox/ | head -20
          volumeMounts:
            - name: debug-tools-busybox
              mountPath: /debug-tools/busybox

        # Netshoot Init Container
        - name: debug-tools-netshoot
          image: nicolaka/netshoot:latest
          imagePullPolicy: IfNotPresent
          command: ['sh', '-c']
          args:
            - |
              echo "Installing Netshoot debug tools..."
              mkdir -p /debug-tools/netshoot/bin
              for tool in curl wget nc nslookup dig tcpdump netstat ss iperf3 mtr traceroute nmap; do
                if command -v $tool >/dev/null 2>&1; then
                  cp $(command -v $tool) /debug-tools/netshoot/bin/ 2>/dev/null || true
                fi
              done
              echo "Netshoot tools installed successfully at /debug-tools/netshoot/bin"
              ls -la /debug-tools/netshoot/bin/

          volumeMounts:
            - name: debug-tools-netshoot
              mountPath: /debug-tools/netshoot

      # Main Application Container
      containers:
        - name: payment-api
          image: myregistry.com/payment-api:v1.2.3
          ports:
            - containerPort: 3000
              protocol: TCP
          env:
            - name: NODE_ENV
              value: production
            - name: DATABASE_URL
              value: postgresql://...
          volumeMounts:
            # Debug tools mounted to main container
            - name: debug-tools-busybox
              mountPath: /debug-tools/busybox
            - name: debug-tools-netshoot
              mountPath: /debug-tools/netshoot

      # Volumes
      volumes:
        - name: debug-tools-busybox
          emptyDir: {}
        - name: debug-tools-netshoot
          emptyDir: {}
```

## Step 5: Pod Startup Sequence

```
Timeline:
  0s  - Pod created
  1s  - Init Container: debug-tools-busybox starts
  3s  - BusyBox tools copied successfully
  3s  - Init Container: debug-tools-busybox completes ✓
  4s  - Init Container: debug-tools-netshoot starts
  12s - Netshoot tools copied successfully
  12s - Init Container: debug-tools-netshoot completes ✓
  13s - Main Container: payment-api starts
  15s - Application ready ✓
```

## Step 6: Developer Accesses the Pod

```bash
# Get pod name
kubectl get pods -n production | grep payment-api
# payment-api-7d8f9c5b6-x7k2m   1/1   Running   0   2m

# Exec into the pod
kubectl exec -it payment-api-7d8f9c5b6-x7k2m -n production -- sh
```

## Step 7: Using Debug Tools

### Scenario A: Check Application Logs

```bash
# Use BusyBox tools
/debug-tools/busybox/ls -la /app/logs/
/debug-tools/busybox/cat /app/logs/error.log
/debug-tools/busybox/grep "ERROR" /app/logs/app.log
/debug-tools/busybox/tail -f /app/logs/app.log
```

### Scenario B: Test Network Connectivity

```bash
# Use Netshoot tools
/debug-tools/netshoot/bin/curl -v https://api.stripe.com/v1/health
/debug-tools/netshoot/bin/dig database.internal.svc.cluster.local
/debug-tools/netshoot/bin/nslookup redis-master
/debug-tools/netshoot/bin/netstat -tulpn
/debug-tools/netshoot/bin/tcpdump -i eth0 port 3000
```

### Scenario C: Add Tools to PATH (Optional)

```bash
# Add both toolsets to PATH for easier access
export PATH=/debug-tools/busybox:/debug-tools/netshoot/bin:$PATH

# Now can use tools directly
ls -la
curl https://api.stripe.com/v1/health
grep "ERROR" /app/logs/app.log
dig database.internal.svc.cluster.local
```

## Step 8: Debugging Session

### Problem: Payment API can't connect to Stripe

```bash
# 1. Check if DNS resolution works
/debug-tools/netshoot/bin/nslookup api.stripe.com
# Output: Server: 10.96.0.10
#         Address: 10.96.0.10#53
#         Name: api.stripe.com
#         Address: 54.187.174.169

# 2. Check if we can reach Stripe
/debug-tools/netshoot/bin/curl -v https://api.stripe.com/v1/health
# Output: * Connected to api.stripe.com (54.187.174.169) port 443
#         * SSL connection using TLSv1.3
#         < HTTP/2 200
#         {"status": "ok"}

# 3. Check application logs
/debug-tools/busybox/grep "stripe" /app/logs/app.log
# Output: [ERROR] Stripe API key not set
#         [ERROR] Failed to initialize Stripe client

# 4. Check environment variables
/debug-tools/busybox/env | /debug-tools/busybox/grep STRIPE
# Output: (empty - API key missing!)

# 5. Root cause found: Missing STRIPE_API_KEY environment variable
```

### Solution: Add missing environment variable

Developer updates the service configuration to add `STRIPE_API_KEY` environment variable, then redeploys.

## Step 9: Verify Fix

```bash
# After redeployment, check again
kubectl exec -it payment-api-7d8f9c5b6-y8m3n -n production -- sh

# Check environment
/debug-tools/busybox/env | /debug-tools/busybox/grep STRIPE
# Output: STRIPE_API_KEY=sk_live_...

# Check logs
/debug-tools/busybox/tail /app/logs/app.log
# Output: [INFO] Stripe client initialized successfully
#         [INFO] Payment API ready

# Test payment endpoint
/debug-tools/netshoot/bin/curl -X POST http://localhost:3000/api/payments \
  -H "Content-Type: application/json" \
  -d '{"amount": 1000, "currency": "usd"}'
# Output: {"id": "pay_123", "status": "succeeded"}

# ✅ Problem solved!
```

## Benefits Demonstrated

### 1. Multiple Tools Available
- Used BusyBox for file operations and log analysis
- Used Netshoot for network diagnostics
- Both tools available simultaneously without switching

### 2. Isolated Tool Paths
- Each tool in its own directory
- No conflicts between tools
- Clear organization

### 3. Efficient Debugging
- Found root cause quickly using appropriate tools
- No need to rebuild container with debug tools
- No need to install tools at runtime

### 4. Production-Safe
- Debug tools don't affect application code
- Tools are in separate volumes
- Can be disabled without changing application image

## Comparison: Before vs After

### Before (Single Tool)

```
Problem: Need both shell and network tools
Solution: 
  1. Enable BusyBox → Deploy → Debug → Not enough tools
  2. Disable BusyBox, Enable Netshoot → Redeploy → Debug
  3. Still need shell tools → Switch back to BusyBox → Redeploy
  4. Repeat cycle...

Time wasted: 30+ minutes of redeployments
```

### After (Multiple Tools)

```
Problem: Need both shell and network tools
Solution:
  1. Enable BusyBox + Netshoot → Deploy → Debug → Problem solved!

Time saved: 25+ minutes
```

## Real-World Use Cases

### Use Case 1: Database Connection Issues
**Tools Needed**: BusyBox (logs) + Netshoot (network)
```bash
/debug-tools/busybox/grep "database" /app/logs/error.log
/debug-tools/netshoot/bin/dig postgres.database.svc.cluster.local
/debug-tools/netshoot/bin/nc -zv postgres.database.svc.cluster.local 5432
```

### Use Case 2: Performance Investigation
**Tools Needed**: BusyBox (process monitoring) + Netshoot (network stats)
```bash
/debug-tools/busybox/top
/debug-tools/busybox/ps aux
/debug-tools/netshoot/bin/netstat -s
/debug-tools/netshoot/bin/ss -s
```

### Use Case 3: API Integration Testing
**Tools Needed**: Netshoot (HTTP client)
```bash
/debug-tools/netshoot/bin/curl -v https://external-api.com/health
/debug-tools/netshoot/bin/wget -O- https://external-api.com/data
```

### Use Case 4: File System Issues
**Tools Needed**: BusyBox (file operations) + Ubuntu (advanced tools)
```bash
/debug-tools/busybox/ls -laR /app/
/debug-tools/busybox/df -h
/debug-tools/ubuntu/bin/du -sh /app/*
```

## Conclusion

The multi-debug-tools feature significantly improves the debugging experience by:
- ✅ Eliminating the need to switch between tools
- ✅ Reducing deployment cycles during debugging
- ✅ Providing the right tool for each debugging scenario
- ✅ Maintaining clean separation between tools
- ✅ Supporting production-safe debugging practices

This real-world example demonstrates how the feature solves actual problems developers face when debugging containerized applications in Kubernetes.
