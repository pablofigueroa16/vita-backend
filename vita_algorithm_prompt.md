# Vita Social Ecommerce Algorithm Specification Prompt for Cursor

Actúa como un Staff Engineer / Arquitecto de Software especializado en algoritmos de recomendación, social commerce y sistemas de recompensas.

Quiero que diseñes y empieces a implementar **el algoritmo principal de la plataforma VITA**, que es una **social ecommerce** con contenido, productos, servicios y un sistema de recompensas tipo “Vita Levels”.

### Stack sugerido (adáptalo pero sé concreto)
- Backend: TypeScript (Node.js)
- Framework: NestJS o Express (elige uno y sé consistente)
- Base de datos: PostgreSQL
- ORM: Prisma o TypeORM (elige uno y define modelos)
- Estilo de código: limpio, modular, con separación clara entre dominio, infraestructura y API.

---

## 1. Contexto de negocio de VITA (muy importante)

VITA es una plataforma de **social ecommerce verificada** donde:
- Usuarios consumen contenido, siguen creadores y compran productos/servicios.
- Creadores y marcas venden productos físicos y servicios digitales.
- TODO el sistema está optimizado para:
  - calidad de contenido,
  - reputación (reseñas, devoluciones),
  - ventas reales,
  - originalidad humana (no depender solo de IA),
  - y un sistema de niveles/recompensas tipo YouTube, pero mejor.

### Modelo económico clave:
- Creadores y marcas pagan una **suscripción mensual de 14.99 USD**.
- El **vendedor NO paga comisión** por venta (0% fee al vendedor).
- El **comprador paga un fee del 5.5%** sobre el monto total de la compra.
- VITA, además, paga **bonos por nivel** a los creadores y marcas (2%–15% adicionales sobre sus ventas, según el nivel alcanzado).

Este modelo debe estar contemplado en el diseño del dominio, pero el foco de este task es:
1. El **algoritmo de ranking del feed “Para ti”**.
2. El **sistema de niveles y recompensas “Vita Levels”**.
3. La forma de **medir métricas y agregarlas**.

---

## 2. Diseño del Algoritmo de Ranking de Contenido (“Para Ti”)

Diseña y documenta un servicio que, dado un usuario, devuelva un feed ordenado de ítems (posts de productos/servicios) usando un **score** por ítem.

Cada ítem `i` tiene métricas:
- `L_i`, `C_i`, `Imp_i`, `Rating_i`, `RevCount_i`, `Sales_i`, `Returns_i`, `Clicks_i`, `AgeHours_i`, `AI_Ratio_i`, `item_type`.

### Sub-índices:
Engagement:
E_i = (0.4*L_i + 1.0*C_i) / (Imp_i + 1)^0.7

Calidad:
Q_i = (Rating_i / 5) * ln(1 + RevCount_i)

Ventas:
Conv_i = Sales_i / (Clicks_i + 1)
V_i = ln(1 + Sales_i) * Conv_i

Devoluciones:
ReturnRate_i = Returns_i/Sales_i si Sales_i > 0, sino 0
D_i = ReturnRate_i^2

Antigüedad:
T_i = exp(-λ * AgeHours_i)

### Normalización:
NormX_i = min(X_i / (P95_X + ε), 1)

### Score por tipo:
Productos:
BaseScore_prod_i = 0.25*Eng + 0.25*Qual + 0.35*SalesPerf - 0.25*ReturnsPen
Score_prod_i = BaseScore_prod_i * T_i

Servicios:
BaseScore_serv_i = 0.30*Eng + 0.35*Qual + 0.20*SalesPerf - 0.15*ReturnsPen
Score_serv_i = BaseScore_serv_i * T_i

### Penalización IA:
AI_Penalty_i = 1 - 0.15 * AI_Ratio_i (mínimo 0.7)

ScoreFinal_i = Score_type_i * AI_Penalty_i * (1 + BonusLevel_for_creator)

### API del ranking:
getForYouFeed(userId, limit, offset)

---

## 3. Sistema de Niveles “Vita Levels”

Niveles:
Seed, Bronze, Silver, Gold, Emerald, Sapphire, Diamond, Black.

CreatorScore mensual:
CreatorScore = 0.25Avg(Eng) + 0.25Avg(Qual) + 0.30Avg(SalesPerf) - 0.10Avg(ReturnsPen) + 0.10OriginalidadGlobal

Cada nivel tiene:
- min_followers
- min_sales_last_30d
- min_avg_rating
- max_return_rate
- min_creator_score
- bonus_percentage (2%–15%)

Jobs mensuales para actualizar niveles y payouts.

---

## 4. Modelo de negocio:

### Suscripción:
Creadores/marcas pagan 14.99 USD/mes.

### Fee del comprador:
buyer_fee = order_total * 0.055

### Bonos por nivel:
bonus_amount = sales_total * bonus_percentage

---

## 5. Entregables en código:
- Diagramas de entidades
- Modelos de BD (Prisma o TypeORM)
- Servicios de dominio para ranking, niveles, métricas, payouts
- Endpoints:
  - GET /feed/for-you
  - GET /creators/:id/summary
  - GET /items/:id/score
- Jobs diarios y mensuales

El código debe estar estructurado en módulos:
- ranking
- levels
- billing/subscriptions
- metrics

Documenta todo con claridad. Usa TypeScript idiomático y patrones de arquitectura limpia.
