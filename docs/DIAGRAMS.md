# System Diagrams

These diagrams use Mermaid syntax. They can be pasted into Mermaid Live Editor, GitHub Markdown, or supported documentation tools.

## Architecture Diagram

```mermaid
flowchart LR
    User[Visually Impaired User] --> Browser[Accessible Web Dashboard]
    Browser --> Voice[Web Speech API]
    Browser --> Camera[Camera / Image Upload]
    Browser --> Flask[Flask Backend]
    Flask --> OpenCV[OpenCV Note Preprocessing]
    OpenCV --> Model[Currency AI Model]
    Flask --> Fake[Fake Note Heuristic Analyzer]
    Flask --> Chatbot[Rule-based AI Chatbot]
    Flask --> Data[(Settings and History JSON)]
    Model --> Flask
    Flask --> Browser
    Browser --> TTS[Voice Output]
```

## DFD Level 0

```mermaid
flowchart TD
    U[User] -->|Voice command / image| S[AI Currency Detection System]
    S -->|Detection result / spoken feedback| U
    S -->|Store history/settings| D[(Data Store)]
    S -->|Currency image| M[AI Model]
    M -->|Prediction| S
```

## DFD Level 1

```mermaid
flowchart TD
    U[User] --> A[Voice Secure Access]
    A --> B[Dashboard Controller]
    B --> C[Currency Detection]
    B --> F[Fake Note Detection]
    B --> N[Multiple Note Counter]
    B --> H[History Manager]
    B --> E[Emergency SOS]
    B --> CH[Chatbot]
    C --> P[OpenCV Preprocessing]
    P --> M[AI Model]
    M --> C
    C --> H
    F --> H
    N --> H
    H --> D[(History JSON)]
    B --> ST[(Settings JSON)]
```

## Use Case Diagram

```mermaid
flowchart LR
    User((User))
    User --> Auth[Authenticate by Voice]
    User --> Scan[Detect Currency]
    User --> Fake[Check Fake Currency]
    User --> Count[Count Multiple Notes]
    User --> History[View / Export History]
    User --> SOS[Activate Emergency SOS]
    User --> Chat[Ask Chatbot]
    User --> Settings[Change Settings]
```

## Sequence Diagram

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Dashboard
    participant API as Flask API
    participant CV as OpenCV
    participant AI as AI Model
    participant DB as History Store

    U->>UI: Say "Open Currency Scanner"
    UI->>U: Speak "Opening Currency Detection"
    U->>UI: Capture note image
    UI->>API: POST /detect
    API->>CV: Crop note region
    CV-->>API: Cropped image
    API->>AI: Predict denomination
    AI-->>API: Label + confidence
    API->>DB: Save detection history
    API-->>UI: JSON result
    UI->>U: Speak detected currency
```

## Flowchart

```mermaid
flowchart TD
    Start([Open Website]) --> Splash[Animated Splash Screen]
    Splash --> Phrase{Says Start Secure Access?}
    Phrase -- No --> Listen[Keep Listening]
    Listen --> Phrase
    Phrase -- Yes --> Color[Ask Secret Color]
    Color --> Check{Color Correct?}
    Check -- Yes --> Dashboard[Open Dashboard]
    Check -- No --> Attempts{3 Wrong Attempts?}
    Attempts -- No --> Color
    Attempts -- Yes --> Lock[Lock for 30 Seconds]
    Lock --> Phrase
    Dashboard --> Feature{Select Feature}
    Feature --> Scan[Currency Detection]
    Feature --> Fake[Fake Detection]
    Feature --> Count[Multiple Note Count]
    Feature --> SOS[Emergency SOS]
    Feature --> Chatbot[Chatbot]
    Feature --> Settings[Settings]
```

## ER Diagram

```mermaid
erDiagram
    SETTINGS {
        string language
        string theme
        string secret_color
    }

    HISTORY {
        string type
        string label
        float confidence
        string time
    }

    USER {
        string profile_name
        string accessibility_mode
    }

    USER ||--o{ HISTORY : creates
    USER ||--|| SETTINGS : configures
```
