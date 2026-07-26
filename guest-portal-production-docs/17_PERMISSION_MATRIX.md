# Permission Matrix

## 1. Roles

- Platform Admin
- Organization Owner
- Organization Admin
- Property Manager
- Content Manager
- Staff
- Viewer

## 2. Permission principles

- Deny by default.
- Role grants permission; property assignment limits scope.
- Frontend hiding is not authorization.
- Staff has no organization-wide access unless assigned.
- Owner role cannot be removed from last active owner.

## 3. Matrix

| Permission | Owner | Org Admin | Property Manager | Content Manager | Staff | Viewer |
|---|---:|---:|---:|---:|---:|---:|
| organization.read | Y | Y | Y | Y | Y | Y |
| organization.update | Y | Y | N | N | N | N |
| property.create | Y | Y | N | N | N | N |
| property.read | Y | Y | assigned | assigned | assigned | assigned |
| property.update | Y | Y | assigned | N | N | N |
| portal.read | Y | Y | assigned | assigned | N | Y |
| portal.update | Y | Y | assigned | assigned | N | N |
| portal.publish | Y | Y | assigned | configurable | N | N |
| knowledge.read | Y | Y | assigned | assigned | N | Y |
| knowledge.create | Y | Y | assigned | assigned | N | N |
| knowledge.publish | Y | Y | assigned | configurable | N | N |
| catalog.read | Y | Y | assigned | assigned | assigned | Y |
| catalog.manage | Y | Y | assigned | configurable | N | N |
| request.read | Y | Y | assigned | N | assigned | Y |
| request.assign | Y | Y | assigned | N | self/assigned | N |
| request.transition | Y | Y | assigned | N | assigned | N |
| order.read | Y | Y | assigned | N | assigned | Y |
| order.transition | Y | Y | assigned | N | assigned | N |
| conversation.read | Y | Y | assigned | N | assigned | N |
| conversation.reply | Y | Y | assigned | N | assigned | N |
| team.read | Y | Y | assigned | N | N | N |
| team.manage | Y | Y | N | N | N | N |
| analytics.read | Y | Y | assigned | N | N | Y |
| audit.read | Y | Y | assigned subset | N | N | N |
| security.manage | Y | configurable | N | N | N | N |

## 4. Test generation

Mỗi ô trong matrix phải sinh ít nhất một authorization test:

- Allowed path returns expected response.
- Denied path returns 403 or resource-hiding 404 according to policy.
- Cross-property path denied.
- Cross-organization path denied.
