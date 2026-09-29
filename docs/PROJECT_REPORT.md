# Project Report

## Title

AI Powered Smart Currency Detection System for Visually Impaired People

## Abstract

The project is an AI-assisted accessibility system that helps visually impaired users identify Indian currency notes through camera input and voice output. It combines a Flask backend, TensorFlow-based currency classification, OpenCV note preprocessing, a professional web dashboard, voice secure access, fake currency indicative analysis, multiple note counting, detection history, chatbot assistance, settings, and emergency SOS support.

## Problem Statement

Visually impaired people often face difficulty identifying currency denominations independently, especially in busy public environments, low light, or while handling multiple notes. A reliable voice-assisted AI system can reduce dependency on others and improve financial independence.

## Objectives

- Detect Indian currency notes through camera or image upload.
- Provide clear voice feedback after detection.
- Support hands-free voice navigation.
- Replace PIN authentication with voice secure access.
- Count multiple notes and calculate total amount.
- Provide an indicative fake-note check.
- Store and export detection history.
- Offer emergency and chatbot support.
- Deliver a product-grade user interface suitable for major project demonstration.

## Existing System

Traditional currency identification methods rely on touch, manual sorting, or help from another person. Mobile apps exist, but many student systems lack accessibility-first navigation, robust UI, history, emergency support, and a clear AI training/evaluation plan.

## Proposed System

The proposed system uses a single dashboard interface controlled by voice and buttons. Users authenticate by saying a secure phrase and secret color. After authentication, they can open currency detection, fake note detection, multiple note counter, chatbot, settings, history, help, and emergency SOS without leaving the dashboard.

## Modules

1. Voice Secure Access
2. Currency Detection
3. Fake Currency Detection
4. Multiple Note Counter
5. Detection History
6. Emergency SOS
7. AI Voice Chatbot
8. Settings
9. Help and About Project

## Methodology

The user opens the web app, completes voice secure access, selects a dashboard feature, and captures or uploads currency images. The backend preprocesses the image using OpenCV, classifies the note using the trained model, stores the result in history, and returns the result to the dashboard. The frontend speaks the result using text-to-speech.

## Dataset Plan

Recommended dataset size is at least 2000 images per denomination/class. Classes should include Rs 10, Rs 20, Rs 50, Rs 100, Rs 200, Rs 500, and Rs 2000, including old and new variants where possible. Images should cover multiple real-world conditions such as front side, back side, folds, blur, angle, occlusion, varied backgrounds, and lighting.

## Model Plan

The current model can remain as a baseline. For higher accuracy, train YOLOv8 or YOLOv11 for note detection and denomination classification. If using pure classification, EfficientNetB3 or MobileNetV3 can be compared with the existing model.

## Advantages

- Accessible voice-first workflow.
- Single dashboard experience.
- Real-time camera support.
- History and export support.
- Emergency assistance panel.
- Professional UI suitable for demonstration and portfolio.

## Limitations

- Fake currency detection is indicative, not legally certified.
- Accuracy depends heavily on dataset quality.
- Browser speech recognition support is best in Chrome.
- Camera and microphone permissions are required.

## Future Scope

- Train and deploy YOLOv11 with a larger Indian currency dataset.
- Add Firebase or SQLite user accounts.
- Add real SMS gateway integration for SOS.
- Add multilingual speech recognition tuning.
- Add offline model inference with TensorFlow Lite or ONNX Runtime.
- Add certified fake-note features using UV/security-marker hardware.

## Conclusion

The system demonstrates a complete AI accessibility product for currency assistance. It combines practical AI inference, voice interaction, accessible design, and safety-oriented features, making it suitable for VTU final-year project demonstration, hackathons, exhibitions, and portfolio presentation.
