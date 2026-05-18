# NooRganics Farm Resource Management System (FMS)
### Universal Admin Cockpit & Mobile Edge Client

[![Framework](https://img.shields.io/badge/Framework-React__Native__/__Expo-61dafb?logo=react)](https://reactnative.dev/)
[![Database](https://img.shields.io/badge/Database-Cloud__Firestore-ffca28?logo=firebase)](https://console.firebase.google.com/u/0/project/fms-ai-dev/firestore/databases/-default-/data)
[![AI Engine](https://img.shields.io/badge/AI__Engine-Vet__7B__Merged-ff6b6b?logo=huggingface)](https://huggingface.co/moeed101/noorganics-vet-7b-merged)
[![Platform](https://img.shields.io/badge/Platform-Expo__Build-34d399?logo=expo)](https://expo.dev/accounts/moddy19/projects/fms-mobile-app/builds/de8a1c6f-8fab-4eda-ac96-0a62889cf28f)

---

## 🔐 🎯 Quick-Access Demo Credentials
To allow judges and technical reviewers to evaluate both the **Web Mainframe Dashboard** and the **Mobile Edge Client** seamlessly without hitting authorization barriers, use the following credentials:

* **Administrator/Judge User ID:** `moeed`
* **Secure Access Password:** `moddy`

---

## 📋 System Overview
The **NooRganics Farm Resource Management System** is a hybrid, enterprise-grade agricultural management platform built to optimize smallholder dairy operations and decentralized supply chains. The project bridges the gap between field-level operational realities and advanced data analytics through a decoupled, split-execution architecture. The system consists of a centralized Web Mainframe Dashboard and a lightweight Mobile Edge Client, working in tandem to deliver real-time resource tracking, dynamic livestock biometrics, and precision logistics coordination.

---

## 🛠️ Core Software Paths

### 1. Mainframe Web Dashboard
Serves as the central administrative hub for global analytics, long-term business economics, inventory reconciliation, and master ledger auditing. It handles heavy relational processing, data archival, and deep compliance monitoring across the entire agricultural matrix.

### 2. Mobile Edge Client
A lightweight mobile deployment engineered specifically for frontline agricultural workers operating in environments characterized by unstable or non-existent cellular connectivity. The mobile app functions strictly as a high-velocity data acquisition and diagnostic terminal.

---

## 🧠 Hybrid Compute & Integration Architecture
The primary innovation of the NooRganics system is its **dual-vector AI routing module**, which shifts the computational burden away from mobile device processors while ensuring absolute operational uptime in the field.

* **Cloud Vector (Hugging Face API):** When internet connectivity is active, the application streams structured data frames over the network. Processing is offloaded to cloud-hosted Generative AI models (LLMs) to execute heavy machine learning operations, such as generating real-time logistics distribution strategies. The payload structures are also fully architected to route multi-angle image data to Vision Transformer ensembles for automated Body Condition Scoring (BCS) in future updates.
* **Edge Vector (Ollama Container):** In the event of network dropouts, the system automatically redirects telemetry to containerized server hardware running decentralized, quantized large language models directly within the physical barn gates. This edge node localizes data processing to generate offline clinical triage alerts, precision dietary ration adjustments, and immediate diagnostic outputs.

---

## 🚀 Key Functional Features

### 🔹 Precision Biometrics with Cryptographic Anchoring
To simulate future computer vision metrics for the MVP, the system routes inputs through a deterministic trait generator. It extracts string character codes from unique livestock tag identifiers to produce distinct, repeatable size and body score profiles. If a technician inputs physical measurements manually, the model automatically overrides simulated baselines to preserve true mathematical metrics.

### 🔹 Gender-Adaptive Diagnostics
To prevent clinical diagnostic error, input fields dynamically query current herd profile records. If a male asset tag is selected, field layouts instantly adapt, shifting from female traits (such as udder inflammation and mastitis profiling) to male-specific observations (such as scrotal localized inflammation) prior to cloud or edge parsing.

### 🔹 Real-Time Logistics & Accrual Ledgers
The distribution engine coordinates delivery sheets across geographical areas using date-scheduled calendar algorithms. It maintains a true accrual ledger tracking monthly billed volumes, delivery penalties, broken asset overhead, and historical customer arrears. A cloud synchronization guard reconciles manual driver dispatches against automated system entries to isolate and record operational spoilage losses.

### 🔹 Local Isolation Vault
Mobile operations read and write asynchronously to an offline cache via a local NoSQL storage structure. Once a network handshake is restored, files are routed through the Quarantine Hub on the dashboard, where administrators review, approve, and finalize updates to the master cloud database.

---

## 🎯 AI Architecture & Technical Scope (MVP)
To deliver a robust, offline-first edge client within the time constraints of this build, we strategically divided our AI implementation into two phases:

1. **Live Production AI (Logistics & Routing):** The application features a fully operational, live connection to a Generative AI model. The Logistics Hub dynamically analyzes supply chain metrics and customer arrears, routing the data through our hybrid edge-to-cloud `AIEngine` to generate real-time distribution strategies.
2. **Frontend Prototyping (Computer Vision):** Training an accurate, reliable veterinary Vision Transformer requires a massive dataset of labeled body condition scores. For this MVP, the Computer Vision Body Condition Scoring module is an interactive frontend prototype. The UI, payload structures, and offline data vaults are fully built and tested using deterministic algorithms, ready to seamlessly integrate with our custom vision model in Phase 2.

---

## ⚙️ Local Development Installation

### Prerequisites
* Node.js (v18 or higher)
* npm or yarn
* Expo CLI installed globally (`npm install -g expo-cli`)

### Quickstart Setup

1. **Clone the Repository:**
```bash
git clone [https://github.com/moeednazki/noorganics-mainframe-edge.git](https://github.com/moeednazki/noorganics-mainframe-edge.git)
cd noorganics-mainframe-edge

2. Install Application Dependencies:

Bash
npm install

3. Boot the Local Development Suite:

Bash
npx expo start --web

├── src/
│   ├── components/         # Common UI Components (BCS Wizard, Layouts)
│   ├── screens/            # Application Interface Architecture
│   │   ├── LoginScreen.js          # Extended 8-Second Auth Race Conditions
│   │   ├── AdminDashboardScreen.js # Master Quarantine Sync Engine
│   │   ├── HerdDirectoryScreen.js  # Resilient Real-time Snapshot Buffers
│   │   ├── CowAssessmentScreen.js  # Dynamic Biometric Processing Engine
│   │   └── LogisticsScreen.js      # Accrual Ledger & Routing Management
│   ├── services/           # External Pipeline Drivers
│   │   ├── firebaseConfig.js       # Singleton Persistent Local Cache Connection
│   │   └── AIEngine.js             # Dual-Vector Dynamic Network Router Core
│   └── utils/              # Math Matrix Utility Libraries

***

### Save and Push commands
Open your terminal and execute these to push the clean changes up to your repository right away:
```bash
git add README.md
git commit -m "docs: finalize setup documentation with corrected top status badges and system login variables"
git push
