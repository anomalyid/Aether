# Aether SDK Python

SDK Python untuk API Aether tanpa dependency eksternal (stdlib `urllib`).

## Pemakaian

```python
from aether_sdk import AetherClient

client = AetherClient(
    base_url="http://localhost:3000",
    tenant_id="tenant_1",
    principal_id="prin_1",
)

capabilities = client.capabilities.list()
result = client.capabilities.invoke(
    "messaging.send",
    {"destination": "62812", "content": "Halo"},
)
run = client.agents.run("asisten", {"pesan": "Halo"})
```

Error API dipetakan menjadi `AetherApiError` dengan `code`, `status`, `request_id`, dan `details`.

## Test

```bash
cd developer/sdk-python
python3 -m unittest discover -s tests -v
```

**By Anomalyid.**
