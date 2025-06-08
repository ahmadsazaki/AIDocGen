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

// Style prompts
const stylePrompts = {
    default: "",
    nytimes: "Write in the style of The New York Times. Use polished, formal language with clear structure and contextual framing. Maintain a measured, authoritative tone and prioritize accuracy and nuance. Provide relevant background information where needed to situate the story within a broader social or historical context. Do not repeat the narrative in subsequent sections.",
    guardian: "Write in the style of The Guardian. Use a conversational, engaging tone with occasional very light British wit and a progressive perspective. Favor clarity and accessibility over formality, and where appropriate, adopt an advocacy-driven or questioning stance. Avoid excessive institutional voice. Do not repeat the narrative in subsequent sections.",
    washington: "Write in the style of The Washington Post. Use clear, direct, and analytical prose. Maintain a pragmatic and objective tone, with an emphasis on accountability and political implications. Focus on factual clarity and well-structured reporting, allowing the significance of the facts to drive the narrative. Do not repeat the narrative in subsequent sections.",
    wsj: "Write in the style of The Wall Street Journal. Use concise, business-oriented language with a focus on facts and analysis. Maintain a professional tone that emphasizes financial and economic implications. Prioritize clear, direct reporting with minimal embellishment. Include relevant data points and market context where appropriate. Do not repeat the narrative in subsequent sections."
};

// Rewrite prompts for full document restructuring
const rewritePrompts = {
    nytimes: "Rewrite this entire document in New York Times style. Reorganize content for better narrative flow, applying consistent voice and tone throughout. Structure as a cohesive article with:\n1. A compelling lede paragraph\n2. Clear section transitions\n3. Proper contextual framing\n4. Authoritative, nuanced analysis\nMaintain all key information while improving presentation and readability.",
    guardian: "Rewrite this document in Guardian style. Transform into a cohesive piece with:\n1. Engaging, conversational tone\n2. Light British wit where appropriate\n3. Progressive perspective\n4. Clear section flow\nEnsure it reads as one unified article rather than separate sections, while preserving all essential content.",
    washington: "Restructure this document in Washington Post style. Create a cohesive analysis with:\n1. Clear, direct prose\n2. Strong factual foundation\n3. Political/policy context\n4. Smooth transitions\nMaintain accountability focus and pragmatic tone throughout the entire piece.",
    wsj: "Rewrite this document in Wall Street Journal style. Transform into a cohesive business-oriented piece with:\n1. Concise, factual language\n2. Economic/financial context\n3. Clear section flow\n4. Professional tone\nEnsure consistent style throughout while preserving all key information and data points."
};

// Document structure prompt
const structurePrompt = `Analyze the topic "{topic}" and create a comprehensive document structure with:
    1. Main sections (3-5 major themes)
    2. Subsections for each main section (3-5 subtopics per theme)
    3. Specific prompts to generate content for each subsection
    Format as markdown with:
    # Section Title
    ## Subsection Title
    ### Prompt: [specific instruction for this subsection]
    Include all necessary prompts to fully cover the topic.`;

let currentStyle = "default";

// Move status message to where prompt display was - only if not already moved
if (!document.getElementById('status-container')) {
    const statusContainer = document.createElement('div');
    statusContainer.id = 'status-container';
    statusContainer.style.margin = '20px 0';
    document.querySelector('.output-section').insertBefore(statusContainer, document.querySelector('.step-indicator'));
    statusContainer.appendChild(statusMessage);
}

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

// Step indicators
const step1 = document.getElementById('step-1');
const step2 = document.getElementById('step-2');

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
    
    // Update progress bar for step transitions
    const stepPercentage = ((step - 1) / 2) * 100;
    progressBar.style.width = `${stepPercentage}%`;
    progressBar.setAttribute('data-step', step);
    progressBar.setAttribute('data-step-percentage', stepPercentage);
}

// Function to parse and execute document prompts
async function executeDocumentPrompts(topic, structure) {
    const lines = structure.split('\n');
    let currentSection = '';
    let currentPrompt = '';
    let inPrompt = false;
    let documentContent = '';
    let documentContext = '';
    
    // Count total prompts
    const totalPrompts = lines.filter(line => line.startsWith('### Prompt: ')).length;
    let processedPrompts = 0;
    
    // For non-default styles, track covered topics to avoid repetition
    const coveredTopics = new Set();
    
    // Track all section headers to detect duplicates
    const sectionTracker = {};
    
        // Generate default filename from first few words of topic
        const defaultFilename = topic.split(/\s+/).slice(0, 3).join('-').toLowerCase() + '.html';
        document.getElementById('filename-input').value = defaultFilename;
        
        // Add document title at beginning
        documentContent = `# ${topic}\n\n`;
        
        for (const line of lines) {
        if (line.startsWith('# ') || line.startsWith('## ')) {
            // Track section without adding to content yet
            currentSection = line;
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
                const promptProgress = Math.round((processedPrompts / totalPrompts) * 100);
                const currentStep = parseInt(progressBar.getAttribute('data-step'));
                const stepPercentage = parseInt(progressBar.getAttribute('data-step-percentage'));
                
                // Calculate smooth progress from 0-100%
                const overallProgress = currentStep === 1 
                    ? Math.round(promptProgress * 0.5)
                    : Math.round(50 + (promptProgress * 0.5));
                
                progressBar.style.width = `${overallProgress}%`;
                progressBar.textContent = `${overallProgress}%`;
                statusMessage.textContent = `Step ${currentStep}/2 (${overallProgress}%): ${currentSection}`;
                
            // Handle duplicate section headers for all styles
            if (sectionTracker[currentSection]) {
                currentSection = currentSection.replace('(continued)', '') + ' (continued)';
            }
            sectionTracker[currentSection] = true;
            
            let fullContentPrompt = currentPrompt;
            
            if (currentStyle !== 'default') {
                // For non-default styles, include context and style guidelines
                fullContentPrompt = `${stylePrompts[currentStyle]}\n\n`
                    + `Previous Sections Context:\n${documentContent}\n\n`
                    + `Generate the next section about: ${currentSection}\n`
                    + `1. Flow naturally from previous content\n`
                    + `2. Maintain consistent ${currentStyle} voice/tone\n`
                    + `3. Avoid repeating: ${Array.from(coveredTopics).join(', ')}\n\n`
                    + `Content Requirements:\n${currentPrompt}`;
                
                // Track covered topics
                coveredTopics.add(currentSection.replace(/^[#]+/, '').trim());
            } else {
                // Default style keeps original prompt
                if (stylePrompts[currentStyle]) {
                    fullContentPrompt = stylePrompts[currentStyle] + "\n\n" + currentPrompt;
                }
            }
            
            // Ensure the section header is included in the document
            if (line.startsWith('# ') || line.startsWith('## ')) {
                documentContent += '\n\n' + currentSection + '\n';
            }
            
            const result = await callGeminiAPI(fullContentPrompt, topic);
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

// Function to rewrite document in selected style
async function rewriteDocument(content, style) {
    if (style === 'default' || !rewritePrompts[style]) {
        return content; // No rewriting for default style
    }

    statusMessage.textContent = 'Rewriting document in selected style...';
    const rewritten = await callGeminiAPI(
        rewritePrompts[style] + "\n\nDocument to rewrite:\n" + content,
        ''
    );
    return rewritten;
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
        
        let fullPrompt = structurePrompt;
        if (stylePrompts[currentStyle]) {
            fullPrompt = stylePrompts[currentStyle] + "\n\n" + structurePrompt;
        }
        const structure = await callGeminiAPI(fullPrompt, topic);
        markdownOutput.innerHTML = marked.parse(structure);
        
        // Step 2: Execute all prompts sequentially
        currentStep = 2;
        updateStepUI(currentStep);
        documentContent = await executeDocumentPrompts(topic, structure);
        
        // For default style only, do final rewrite if needed
        if (currentStyle === 'default' && rewritePrompts[currentStyle]) {
            statusMessage.textContent = 'Finalizing document...';
            documentContent = await rewriteDocument(documentContent, currentStyle);
            markdownOutput.innerHTML = marked.parse(documentContent);
        }
        
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

// Style button event listeners
document.querySelectorAll('.style-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // Update active button
        document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentStyle = btn.dataset.style;
    });
});

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
        statusMessage.textContent = 'Progress will appear here after you enter a topic.';
    }
});
