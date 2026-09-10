# Horizon Watch

PRODUCT REQUIREMENTS DOCUMENT

AI Smart Disaster Relief Allocation — v2.0

How to use this document: This is the single master brief. Paste it whole into Replit, Figma (Make/First Draft), Emergent, or any other AI builder tool. Section 14 is a locked design mandate — if a tool starts producing a generic dark dashboard with neon accents, rounded card grids, or gradient washes, re-paste Section 14 alone as a correction prompt.

1. Vision & Problem

An AI-driven decision-support system that, after a disaster is detected, predicts severity/impact, estimates affected population and relief demand, prioritizes zones, and optimizes warehouse-to-zone resource allocation and routes. It supports both real-time operation and simulation when no disaster is active.

Scope: Not primarily disaster-occurrence prediction. Core disasters: Flood, Cyclone, Earthquake, Landslide. Man-made disasters are future scope.

2. Core AI Pipeline

Live APIs / Historical Data / GIS → Preprocessing → RF / XGBoost / LightGBM
→ Severity & Impact → Affected Population → Relief Demand → DDPI Priority
→ OR-Tools → Warehouse/Resource Allocation → Route Planning → GIS Dashboard


Severity: Low / Moderate / High / Extreme + normalized score + confidence.

Demand outputs: food, water, medicine, shelter.

Use disaster-specific features; standardize outputs across disasters.

Classification metrics: Accuracy, Precision, Recall, F1, inference time. Regression: MAE, RMSE, R².

Prefer time-aware evaluation (older events for training, later events for testing).

3. Disaster Inputs

Disaster Key Inputs Outputs Flood Rainfall, water/river level, flooded area, elevation, population, infrastructure, river distance, history Severity, affected population, demand Cyclone Wind, pressure, rainfall, intensity/category, coast distance, population, vulnerability, infrastructure Severity, impact, demand Earthquake Magnitude, depth, epicenter, population, building vulnerability, distance, seismic history Severity, impact, demand Landslide Rainfall/duration, slope, elevation, soil, land cover, road proximity, population, history Risk/severity, affected zone, demand

4. DDPI — Dynamic Disaster Priority Index

Proposed decision layer, not a claimed new ML algorithm. Ranks affected zones using predicted severity, affected population, vulnerability, resource scarcity and accessibility/distance. Weights/formula must be experimentally designed and validated.

5. Demand, Warehouse & Optimization

Demand is linked to disaster type, severity, affected population and accessibility/duration.

Warehouse/admin data: location, stock, capacity, status. Vehicle data: capacity and availability. These are operational inputs, not ML predictions.

Google OR-Tools selects warehouses, allocates resources and routes vehicles while respecting stock, capacity and demand.

Objective: reduce travel/cost and unmet demand/resource shortage.

Compare baseline/manual or nearest-warehouse allocation against DDPI + optimization.

6. Live & Simulation Modes

LIVE: detected API event → normalize → predict → demand → priority → optimize → dashboard.

SIMULATION: historical replay or synthetic parameter variation → run the same pipeline → compare outcomes.

Simulation is mandatory so the system remains demonstrable without an active disaster.

Show processing stages as a single animated stepper: detection → data → prediction → impact → demand → priority → allocation → routes. This stepper is the primary "show, don't tell" moment of a demo — see Section 14 for how it should look and move.

API failure must show degraded/last-update status; never fabricate live data.

Baseline hazard state: Even with zero active disasters, the map is never empty — it always shows the standing hazard layer described in Section 7, so the dashboard reads as "monitoring" rather than "broken" between events.

7. Product / UI Requirements

Modern AI emergency command-center interface; React + Vite + plain CSS.

Pages: Login, Dashboard, Disaster Monitoring, Simulation, Resource Management, Allocation Results.

Dashboard KPIs: active disasters, high-risk zones, affected people, shortages; plus demand, inventory, allocation and route views.

7.1 GIS map — two distinct layers, not one

Baseline hazard layer (standing, always visible): historically disaster-prone zones per type — flood-prone belts, cyclone-prone coastline, seismically active fault zones, landslide-prone slopes — rendered as a persistent choropleth/heatmap, independent of whether a disaster is currently active. This is what makes the map meaningful in Simulation mode and between real events. Toggleable per disaster type, visually distinct (muted, static) from the active-event layer below.

Active-event layer (dynamic): disaster zones, affected areas, warehouses, relief routes and vehicles for whatever is currently detected or being simulated. This is the layer that pulses, animates, and updates live.

Leaflet + OpenStreetMap. Clicking a disaster shows severity, confidence, affected population and demand; clicking a warehouse shows inventory/capacity/status.

7.2 Animation — specific, not decorative

Animation must mean something (a state changed) rather than decorate everything uniformly. Concretely:

Zone pulse: pulse radius and speed scale directly with the zone's normalized severity score — Extreme pulses faster/larger than Low. Not a uniform pulse on every marker.

Route/vehicle movement: vehicle icons interpolate along the actual route polyline over time using real ETA/speed data, not a looping dashed-line animation.

Pipeline stepper: one deliberate, orchestrated reveal as the pipeline advances through its stages (Section 6) — not eight cards fading in independently.

KPI counters: count up once when new data arrives, not on every scroll or re-render.

All motion respects prefers-reduced-motion.

No default "fade-and-slide-up on scroll" for every section, and no hover-lift on every card — these are the most common tells of a templated build and are explicitly out of scope. See Section 14.

7.3 Reference interaction patterns (adapted, not copied — see Section 14.5)

Map-dominant hero + docked left analytics rail: the map fills the majority of the screen; a left-side rail holds aggregate KPI tiles (active disasters, high-risk zones, affected population, shortages) at a glance, always visible regardless of which zone is selected.

Click-to-open Zone Detail Card: clicking a zone on the map opens a floating card (not a full-page navigation) showing: zone name/ID, detection timestamp, severity gauge, live disaster-specific inputs from Section 3 (rainfall, water level, wind, magnitude, etc. — whichever apply), an expandable Event / Audit Log section, and a DDPI Insight callout in the ink color (#22261E) with primary-accent text — the model's recommended action and which layer produced it (rule engine vs. ML/DDPI), never a bare black box for decoration's sake.

Functional priority bar: a horizontal Low→Extreme gradient bar on the Zone Detail Card, using the exact severity tokens from 14.1 — legitimate because it encodes the zone's actual DDPI score, not a decorative gradient.

Minimap + layer controls, bottom-right of the map: small minimap thumbnail, zoom controls, and a Hazard Layer / Active Layer toggle (replacing a generic "2D/3D" toggle) so the two map layers from 7.1 are switchable in place.

Plain operator header: "Welcome back, {name} — {role}" in the top bar. No avatar illustration, no decorative greeting art.

Segmented time-window toggle: reused for chart controls (e.g., 6h / 24h / 7d rainfall or water-level trend) — functional, not a decorative pill row.

8. Technology & Architecture

Frontend: React/Vite, Axios, Recharts, React-Leaflet, plain CSS, Framer Motion (required, not optional — animation is a core requirement, not a stretch goal).

Backend: Node.js + Express — authentication, CRUD, orchestration, external APIs.

ML: Python + FastAPI, scikit-learn, XGBoost, LightGBM.

Database: MongoDB. Optimization: Google OR-Tools. Version control: Git/GitHub.

Flow: React → Node/Express → FastAPI → ML/Optimization + MongoDB/APIs → JSON → React.

Secrets/API keys remain backend-only via environment variables/Replit Secrets.

9. Core Data Model

users: name, email, password, role (ADMIN/OPERATOR/ANALYST).

disasters: type, location, coordinates, timestamp, severity, score, affected population, source, mode.

warehouses: name, coordinates, capacity, status. inventory: warehouseId, food, water, medicine, shelter, lastUpdated.

predictions: disasterId, model, severity, affectedPopulation, confidence, timestamp.

allocations: disasterId, zone, warehouse, resources, priority, distance, estimated time.

simulationRuns: disasterType, parameters, prediction, demand, allocation, model, timestamp.

hazardZones (new): disasterType, geometry (GeoJSON polygon), historicalRiskScore, source, lastValidated — backs the baseline hazard layer in Section 7.1.

auditLog (new): entityType (disaster/allocation/simulationRun), entityId, action, actor (system/operator/model), decisionSource (rule-engine/ML/DDPI), timestamp, details — backs the Event/Audit Log section on the Zone Detail Card in 7.3.

10. Key APIs

POST   /api/auth/login
GET/POST /api/disasters
POST   /api/predict/severity
POST   /api/predict/impact
POST   /api/predict/demand
GET/POST/PUT /api/warehouses
GET/PUT /api/inventory
POST   /api/optimize/allocation
POST   /api/simulation/run
GET    /api/allocations/:id
GET    /api/hazard-zones            (new — baseline layer, Section 7.1)
GET    /api/zones/:id                (new — Zone Detail Card data, Section 7.3)
GET    /api/audit-log/:entityId      (new — Event/Audit Log, Section 7.3)


11. Research Contribution & Experiments

Contribution: practical end-to-end integration of impact prediction, demand forecasting, dynamic prioritization, allocation, routing and GIS decision support.

Experiments: RF vs XGBoost vs LightGBM; general model vs disaster-specific models; baseline vs DDPI + OR-Tools; low-to-extreme simulations.

Allocation metrics: unmet demand, transport distance/cost, response time, allocation efficiency and priority satisfaction.

Research base: seven selected papers; two previously excluded papers remain excluded.

12. Four-Month Implementation

Month Focus Deliverable 1 Datasets, EDA, preprocessing, RF/XGB/LGBM Working severity/impact ML pipeline 2 Affected population, demand, MongoDB, FastAPI integration ML → demand → operational database 3 DDPI, OR-Tools, allocation, routing, simulation Decision/optimization engine 4 React, GIS (incl. hazard layer), live/simulation, animation, auth, testing Integrated demonstrable application

13. MVP & Build Priority

MVP: 4 disasters + historical datasets + severity/impact ML + affected population + demand + warehouse/inventory + OR-Tools allocation + simulation + React dashboard + GIS map with baseline hazard layer.

Build order: Flood vertical slice → generalize to 4 disasters → population → demand → warehouse/inventory → DDPI → OR-Tools → simulation → FastAPI/Node integration → dashboard/GIS (hazard layer + active layer)/live APIs → animation pass last, once real data is flowing.

Do not build first: full digital twin, mandatory RL, drones, mandatory satellite segmentation, LLM chatbot, mobile app, complex deep learning, real-time traffic prediction, IoT.

14. Visual Identity — Locked Design Mandate

This section exists because generic AI-generated UI has a recognizable house style, and this project must not have it. The traits to actively avoid: a dark background with a single bright neon/acid accent color; the cream-background-plus-terracotta-accent look; rounded-corner "SaaS card" grids where every card has the same soft grey shadow and gradient wash; tracked-out ALL-CAPS eyebrow labels above every heading; meta text joined with middle dots; labels styled as "WORD — fragment"; arrows appended to every button ("View Details →"). If a builder tool defaults to any of these, reject the output and re-run with this section.

Ground the look in what this actually is: a civic emergency-operations tool — closer in spirit to a government hazard-monitoring console (IMD weather-warning displays, NDMA/NDRF ops rooms, real GIS survey tools) than to a startup analytics SaaS. Legible, daytime-operable, built for someone glancing at it under stress — not a moody dark sci-fi command deck.

14.1 Color — named tokens, not generic defaults

Role Hex Use Base background #EDE8D9 Warm canvas/khaki, like field-ops paper maps — not stark white, not near-black Ink (primary text) #22261E Warm near-black, not pure #000 or #111 Structural line #B9B29B Hairline borders, table rules, panel dividers Primary accent #C1440E Alerts, primary actions, active-disaster markers — hazard-orange, not neon Secondary / brand #1B4B43 Headers, links, water/flood iconography — deep monsoon teal Moderate severity #C9A227 Warehouse/hazard-yellow, matches real relief-signage color Low severity #4B6043 Moss green Extreme severity #7A1F1F Brick red, deliberately distinct from the orange accent so severity levels never get confused

Severity colors map 1:1 to the Low/Moderate/High/Extreme scale in Section 2 — this is functional color, not decoration, and should never be swapped for a generic red-yellow-green traffic-light gradient.

14.2 Typography

Body & UI: Public Sans — a real civic/government-grade typeface family, which fits a command-center tool thematically and reads as considered rather than default.

Headlines: same family, heavier weight — no second display font needed. Do not italicize or recolor single words in headlines for emphasis.

Data readouts only (coordinates, timestamps, confidence scores, magnitudes): a monospace face (e.g. IBM Plex Mono), used only where the content is genuinely tabular/numeric — never as a decorative label style.

Line length under 80 characters for body copy. Sentence case throughout — no tracked-out ALL-CAPS labels.

14.3 Layout

Map-dominant, asymmetric layout: the GIS view takes the majority of the viewport with docked side panels, the way a real GIS ops tool is laid out — not a centered marketing page or a uniform grid of identical dashboard cards.

Left-aligned content and panels; hairline borders and real structural dividers instead of card-shadow-and-gradient stacking.

Numbered steps only where content is a genuine sequence (the pipeline stepper in Section 6) — not decoratively elsewhere.

14.4 Do / Don't summary for builder tools

DO:

Use the exact hex tokens in 14.1 and the severity-color mapping as functional, not decorative.

Use Public Sans for all UI text; reserve monospace strictly for coordinate/telemetry data.

Animate only the specific things listed in Section 7.2, in the specific way described.

Keep the map as the visual center of gravity on every screen where it's relevant.

DO NOT:

Default to a dark theme with a single neon accent.

Use rounded-card grids with uniform drop shadows or gradient washes.

Add ALL-CAPS eyebrow labels, middle-dot meta strings, or arrow-suffixed buttons.

Animate every card on scroll or add hover-lift to everything — motion must correspond to an actual state change (Section 7.2).

Treat the baseline hazard layer and the active-event layer as visually identical — they must read as clearly different things at a glance.

14.5 Reference screens reviewed (this session)

Two reference UIs were reviewed for this revision. Neither should be copied wholesale — both are style references, evaluated and filtered against 14.1–14.4.

Reference A — satellite field-monitoring dashboard (map-dominant, KPI rail, click-to-open detail card, dark AI-insight callout, functional gradient bar, minimap + zoom controls).

Adopt: the overall composition — map-dominant hero, docked KPI rail, click-to-open detail card, functional (not decorative) gradient bar, minimap + layer controls. These are now specified in 7.3.

Adapt, don't copy: its color and card treatment. It leans on plain white cards with soft drop shadows and a stock orange/green palette — replace with the 14.1 token set and hairline-bordered panels (14.3), not shadow-and-white-card stacking.

Reference B — consumer weather dashboard (illustrated, pastel-gradient mockup frame).

Adopt: a plain operator greeting in the header, and a segmented time-window toggle for chart controls. Both are now specified in 7.3.

Reject: the pastel gradient canvas behind the floating app frame, cartoon/illustrated characters (e.g. a person with an umbrella) and decorative weather icons, and the low-contrast rounded pastel card system. These are dribbble-mockup-template tells, not command-center UI, and directly conflict with 14.1's functional color mandate and 14.4's "don't" list. None of Reference B's visual style should carry into the build — only the two structural ideas named above.

Final Project Definition

"An AI-driven real-time and simulation-based decision-support system that predicts disaster severity and impact, forecasts relief demand, prioritizes affected regions, and optimizes warehouse-to-zone resource allocation for flood, cyclone, earthquake and landslide scenarios — presented through a civic-grade command-center interface, grounded in real hazard-monitoring visual language rather than generic dashboard defaults."

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/372c75b7-52f4-4df7-bfbe-735aee4ede40).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
