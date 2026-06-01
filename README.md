<div align="center">
  <img width="1200" alt="COGNIFLOW Banner" src="./new_banner.png" />
</div>

# COGNIFLOW: The AI-Powered Knowledge Graph and Development Studio

**COGNIFLOW** is a cutting-edge application designed to help developers and researchers organize their thoughts, code snippets, and research findings into an interconnected, AI-enhanced knowledge graph. It combines a powerful note-taking interface with a dedicated development studio and utilizes large language models (LLMs) for intelligent analysis, connection discovery, and code assistance.

## Key Features

| Feature | Description | AI Integration |
| :--- | :--- | :--- |
| **Knowledge Graph** | Visualize and explore the semantic connections between your notes, code, and ideas. | Automatically discovers and suggests new connections between notes. |
| **Dev Studio** | A dedicated environment for writing, testing, and managing code snippets with syntax highlighting and version control. | Provides code completion, debugging assistance, and code diff analysis. |
| **AI Chat & Tools** | Interact with a conversational AI to summarize notes, generate tags, and perform complex data analysis. | Uses Gemini and Hugging Face models for various cognitive tasks. |
| **Multimodal Analysis** | Analyze visual media (images) and generate speech from text directly within the application. | Leverages Gemini's multimodal capabilities. |
| **Note Management** | Organize notes into folders, apply tags, and easily search through your entire knowledge base. | AI-powered summarization and automatic tagging. |

## Technology Stack

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React, TypeScript, Vite | Fast, modern user interface development. |
| **State Management** | (Assumed) React Hooks / Context API | Managing application state. |
| **Graph Visualization** | D3.js | Rendering the interactive knowledge graph. |
| **AI Services** | Google GenAI SDK (`@google/genai`) | Integration with Gemini models for core AI features. |
| **Styling** | (Assumed) Tailwind CSS or similar | Utility-first CSS framework for rapid styling. |

## Getting Started

This guide contains everything you need to run your COGNIFLOW application locally.

### Prerequisites

You will need the following installed on your system:
*   **Node.js** (LTS version recommended)
*   **npm** (Node Package Manager)

### Installation and Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Chieji/COGNIFLOW.git
    cd COGNIFLOW
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure API Key:**
    The application requires a **Gemini API Key** for its core AI functionalities. Create a file named `.env.local` in the root of the project and add your key:
    ```
    # .env.local
    
    ```
    *Note: The application is configured to securely load this key only during the development process and should be managed securely in a production environment.*

4.  **Run the application:**
    ```bash
    npm run dev
    ```
    The application will typically be available at `http://localhost:3000`.

## Contributing

We welcome contributions! Please feel free to submit issues and pull requests.

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.
