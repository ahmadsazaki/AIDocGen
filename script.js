const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const API_KEY = 'AIzaSyCV6t6EX9ImuvhajrwQmonPpookCL2mFsM';
const MODEL_NAME = 'gemini-2.0-flash';

const topicInput = document.getElementById('topic-description');
const generateBtn = document.getElementById('generate-btn');
const statusMessage = document.getElementById('status-message');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const loading = document.getElementById('loading');
const markdownOutput = document.getElementById('markdown-output');
const copyBtn = document.getElementById('copy-btn');
const downloadBtn = document.getElementById('download-btn');
const errorMessage = document.getElementById('error-message');

let documentContent = '';
let currentStep = 1;

// Step indicators
const step1 = document.getElementById('step-1');
const step2 = document.getElementById('step-2');

// Prompts for the AI generation
const prompts = [
    `Analyze the topic "{topic}" and create a comprehensive document structure with:
    1. Main sections (3-5 major themes)
    2. Subsections for each main section (3-5 subtopics per theme)
    3. Specific prompts to generate content for each subsection
    Format as markdown with:
    # Section Title
    ## Subsection Title
    ### Prompt: [specific instruction for this subsection]
    Include all necessary prompts to fully cover the topic.`
];

// Prompt display section
const promptDisplay = document.createElement('div');
promptDisplay.id = 'prompt-display';
promptDisplay.style.margin = '20px 0';
promptDisplay.style.padding = '15px';
promptDisplay.style.backgroundColor = '#f8f9fa';
promptDisplay.style.borderRadius = '5px';
promptDisplay.style.borderLeft = '4px solid #3498db';
promptDisplay.innerHTML = `
    <h3 style="margin-top: 0; color: #2c3e50;">Current Prompt</h3>
    <div id="current-prompt" style="font-family: monospace; white-space: pre-wrap;"></div>
`;
document.querySelector('.output-section').insertBefore(promptDisplay, document.querySelector('.step-indicator'));

// Function to make API calls to Gemini with enhanced retry logic
async function callGeminiAPI(prompt, topic, retryCount = 0) {
    // Throttle requests - only allow one at a time
    if (window.activeRequest) {
        await new Promise(resolve => {
            const checkInterval = setInterval(() => {
                if (!window.activeRequest) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 500);
        });
    }
    
    window.activeRequest = true;
    const content = {
        contents: [{
            parts: [{
                text: prompt.replace(/{topic}/g, topic)
            }]
        }]
    };
    
    try {
        const response = await fetch(`${API_URL}?key=${API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(content)
        });
        
        if (response.status === 429) {
            if (retryCount < 3) {
                const waitTime = Math.min(Math.pow(3, retryCount) * 2000, 30000);
                statusMessage.textContent = `Rate limited - next try in ${waitTime/1000} seconds...`;
                
                // Show visual countdown
                const countdownEl = document.createElement('div');
                countdownEl.id = 'countdown';
                countdownEl.style.marginTop = '10px';
                countdownEl.style.fontWeight = 'bold';
                statusMessage.parentNode.insertBefore(countdownEl, statusMessage.nextSibling);
                
                let remaining = waitTime/1000;
                countdownEl.textContent = `${remaining}s remaining`;
                const countdownInterval = setInterval(() => {
                    remaining--;
                    countdownEl.textContent = `${remaining}s remaining`;
                    if (remaining <= 0) {
                        clearInterval(countdownInterval);
                        countdownEl.remove();
                    }
                }, 1000);
                
                await new Promise(resolve => setTimeout(resolve, waitTime));
                return callGeminiAPI(prompt, topic, retryCount + 1);
            }
            throw new Error('API rate limit exceeded. Please try again in a few minutes.');
        }
        
        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }
        
        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw error;
    } finally {
        window.activeRequest = false;
    }
}

// Function to update UI based on steps
function updateStepUI(step) {
    // Reset all steps
    [step1, step2].forEach(s => {
        s.classList.remove('active', 'completed');
    });
    
    // Mark completed steps
    for (let i = 1; i < step; i++) {
        document.getElementById(`step-${i}`).classList.add('completed');
    }
    
    // Mark current step as active
    document.getElementById(`step-${step}`).classList.add('active');
    
    // Update progress bar
    const progressPercentage = ((step - 1) / 2) * 100;
    progressBar.style.width = `${progressPercentage}%`;
}

// Function to parse and execute document prompts
async function executeDocumentPrompts(topic, structure) {
    const lines = structure.split('\n');
    let currentSection = '';
    let currentPrompt = '';
    let inPrompt = false;
    let documentContent = '';
    
    // Count total prompts
    const totalPrompts = lines.filter(line => line.startsWith('### Prompt: ')).length;
    let processedPrompts = 0;
    
    // Generate default filename from first few words of topic
    const defaultFilename = topic.split(/\s+/).slice(0, 3).join('-').toLowerCase() + '.html';
    document.getElementById('filename-input').value = defaultFilename;
    
    for (const line of lines) {
        if (line.startsWith('# ')) {
            // Main section
            currentSection = line;
            documentContent += '\n\n' + line + '\n';
        } else if (line.startsWith('## ')) {
            // Subsection
            currentSection = line;
            documentContent += '\n\n' + line + '\n';
        } else if (line.startsWith('### Prompt: ')) {
            // Start of prompt
            currentPrompt = line.replace('### Prompt: ', '');
            inPrompt = true;
        } else if (inPrompt) {
            // Continuation of prompt
            currentPrompt += '\n' + line;
        }
        
        // Execute prompt when we hit next section or end
        if ((line.startsWith('# ') || line.startsWith('## ') || !line.trim()) && currentPrompt) {
            processedPrompts++;
            const progress = Math.round((processedPrompts / totalPrompts) * 100);
            statusMessage.textContent = `Processing (${progress}%): ${currentSection}`;
            const result = await callGeminiAPI(currentPrompt, topic);
            documentContent += result + '\n';
            markdownOutput.innerHTML = marked.parse(documentContent);
            currentPrompt = '';
            inPrompt = false;
            
            // Add delay between prompts
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    return documentContent;
}

// Function to generate the document
async function generateDocument() {
    const topic = topicInput.value.trim();
    
    if (!topic) {
        showError("Please enter a topic or description.");
        return;
    }
    
    // Reset UI
    documentContent = '';
    markdownOutput.innerHTML = '';
    errorMessage.style.display = 'none';
    copyBtn.disabled = true;
    downloadBtn.disabled = true;
    
    // Show loading state
    loading.style.display = 'flex';
    generateBtn.disabled = true;
    statusMessage.textContent = 'Generating document...';
    progressContainer.style.display = 'block';
    
    try {
        // Step 1: Generate document structure with prompts
        currentStep = 1;
        updateStepUI(currentStep);
        statusMessage.textContent = 'Creating document structure...';
        
        const structure = await callGeminiAPI(prompts[0], topic);
        markdownOutput.innerHTML = marked.parse(structure);
        
        // Step 2: Execute all prompts sequentially
        currentStep = 2;
        updateStepUI(currentStep);
        documentContent = await executeDocumentPrompts(topic, structure);
        
        // Enable action buttons
        copyBtn.disabled = false;
        downloadBtn.disabled = false;
        statusMessage.textContent = 'Document generation complete!';
        
    } catch (error) {
        if (error.message.includes('rate limit')) {
            showError('The AI service is currently experiencing high demand. Please wait 2-3 minutes before trying again for best results.');
            statusMessage.textContent = 'Service busy - please wait before retrying';
        } else {
            const friendlyError = error.message.includes('Failed to fetch') 
                ? 'Network error - please check your internet connection'
                : `Document generation failed: ${error.message}`;
            showError(friendlyError);
            statusMessage.textContent = 'Error occurred - please try again';
        }
    } finally {
        loading.style.display = 'none';
        generateBtn.disabled = false;
    }
}


// Function to show error message
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
}

// Event listeners
generateBtn.addEventListener('click', generateDocument);

// Copy to clipboard functionality
copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(documentContent)
        .then(() => {
            statusMessage.textContent = 'Document copied to clipboard!';
            setTimeout(() => {
                statusMessage.textContent = '';
            }, 3000);
        })
        .catch(err => {
            showError('Failed to copy to clipboard: ' + err);
        });
});

// Enable filename input when document is generated
generateBtn.addEventListener('click', () => {
    const filenameInput = document.getElementById('filename-input');
    filenameInput.disabled = false;
    
    // Generate default filename from first few words of topic
    const topic = topicInput.value.trim();
    if (topic) {
        const defaultFilename = topic.split(/\s+/)
            .slice(0, 3)
            .join('-')
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '') + '.html';
        filenameInput.value = defaultFilename;
    }
});

// Save as HTML functionality
downloadBtn.addEventListener('click', async () => {
    const filenameInput = document.getElementById('filename-input');
    let filename = filenameInput.value.trim() || 'document.html';
    
    if (!filename.endsWith('.html')) {
        filename += '.html';
    }

    try {
        statusMessage.textContent = 'Preparing HTML download...';
        
        // Create HTML template
        const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${filename.replace('.html', '')}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
        }
        h1 { color: #2c3e50; border-bottom: 1px solid #eee; }
        h2 { color: #3498db; }
        pre { background: #f5f5f5; padding: 10px; border-radius: 5px; }
    </style>
</head>
<body>
${marked.parse(documentContent)}
</body>
</html>`;

        // Create blob
        const blob = new Blob([htmlContent], { type: 'text/html' });
        
        // Use File System Access API if available
        if ('showSaveFilePicker' in window) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: filename,
                    types: [{
                        description: 'HTML Files',
                        accept: { 'text/html': ['.html'] }
                    }]
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                statusMessage.textContent = 'Document saved successfully!';
            } catch (err) {
                if (err.name !== 'AbortError') {
                    throw err;
                }
                return;
            }
        } else {
            // Fallback for browsers without File System Access API
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            statusMessage.textContent = 'Document downloaded!';
        }
        
        setTimeout(() => {
            statusMessage.textContent = '';
        }, 3000);
        
    } catch (error) {
        showError('Failed to save document: ' + error.message);
        statusMessage.textContent = 'Error saving document';
    }
});

// Input field event listener
topicInput.addEventListener('input', () => {
    if (topicInput.value.trim() !== '') {
        statusMessage.textContent = 'Ready to generate.';
    } else {
        statusMessage.textContent = 'Enter a description to begin.';
    }
});
