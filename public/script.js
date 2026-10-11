let currentStandard = 'UDC';

async function getClassification() {
    const query = document.getElementById('queryInput').value.trim();
    const standard = document.getElementById('standardInput').value;
    const resultBox = document.getElementById('resultBox');
    const manualBox = document.getElementById('manualBox');
    const btn = document.getElementById('classifyBtn');

    if (!query) {
        alert('Please enter a query first!');
        return;
    }

    currentStandard = standard;
    manualBox.style.display = 'none';
    resultBox.innerHTML = '<p style="text-align:center;color:#888;">Loading...</p>';
    
    // Disable button during request
    btn.disabled = true;
    btn.textContent = 'Classifying...';

    try {
        const response = await fetch('/api/classify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: query, standard: standard })
        });

        const data = await response.json();
        renderResult(data);
    } catch (error) {
        resultBox.innerHTML = `
            <div class="result-box">
                <p class="result-answer error">Server Error</p>
                <p class="audit-line">${error.message}</p>
            </div>
        `;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Get Classification';
    }
}

function renderResult(data) {
    const resultBox = document.getElementById('resultBox');
    const manualBox = document.getElementById('manualBox');

    if (data.status === 'SUCCESS') {
        resultBox.innerHTML = `
            <div class="result-box">
                <p class="result-standard">${data.standard}</p>
                <p class="result-answer">${data.final_answer}</p>
                <p class="audit-title">Audit Log:</p>
                <div class="audit-line">${data.audit.join('<br>')}</div>
            </div>
        `;
    } else {
        resultBox.innerHTML = `
            <div class="result-box">
                <p class="result-standard">${data.standard}</p>
                <p class="result-answer error">${data.final_answer}</p>
                <p class="audit-title">Audit Log:</p>
                <div class="audit-line">${data.audit.join('<br>')}</div>
            </div>
        `;
        manualBox.style.display = 'block';
    }
}

function saveManual() {
    const manualValue = document.getElementById('manualInput').value.trim();
    const resultBox = document.getElementById('resultBox');
    const manualBox = document.getElementById('manualBox');

    if (!manualValue) {
        alert('Please enter a number first!');
        return;
    }

    resultBox.innerHTML = `
        <div class="result-box">
            <p class="result-standard">${currentStandard === 'UDC' ? 'UDC 1961' : 'DDC 23'}</p>
            <p class="result-answer">${manualValue}</p>
            <p style="color:#f39c12;font-size:12px;margin-top:8px;">⚠️ Manual Entry (User Provided)</p>
        </div>
    `;
    manualBox.style.display = 'none';
    document.getElementById('manualInput').value = '';
}

// Enter key support
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('queryInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') getClassification();
    });
});
