document.addEventListener('DOMContentLoaded', function () {
    // Configuration
    const layers = {
        cognitive: ['dim1', 'dim2'],
        process: ['dim3', 'dim4'],
        benefit: ['dim5', 'dim6', 'dim7']
    };

    const dimensionLabels = [
        '语言与理解复杂度',
        '模型擅长领域匹配',
        '业务规范与流程成熟度',
        '上下文与知识完备性',
        '容错性与人机协作机制',
        'ROI清晰度',
        '结果可评估性'
    ];

    let radarChart = null;
    let quadrantChartInstance = null;

    // Initialize UI
    initializeScoreButtons();

    // Event Listeners removed as AI triggers evaluation automatically

    function initializeScoreButtons() {
        const selectors = document.querySelectorAll('.score-selector');

        // Create tooltip element
        let tooltip = document.querySelector('.slider-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'slider-tooltip';
            document.body.appendChild(tooltip);
        }

        selectors.forEach(selector => {
            const dimId = selector.dataset.dim;
            const hiddenInput = document.getElementById(dimId);
            const buttons = selector.querySelectorAll('.score-btn');
            const tooltips = JSON.parse(hiddenInput.dataset.tooltips || '{}');

            const showTooltip = (anchorEl, val) => {
                if (tooltips[val]) {
                    tooltip.textContent = tooltips[val];
                    tooltip.classList.add('visible');
                    positionTooltip(anchorEl, tooltip);
                } else {
                    tooltip.classList.remove('visible');
                }
            };

            const hideTooltip = () => {
                tooltip.classList.remove('visible');
            };

            const positionTooltip = (target, tip) => {
                const rect = target.getBoundingClientRect();
                const tipRect = tip.getBoundingClientRect();

                let left = rect.left + (rect.width / 2) - (tipRect.width / 2);
                let top = rect.top - tipRect.height - 10;

                // Boundary checks
                if (left < 10) left = 10;
                if (left + tipRect.width > window.innerWidth - 10) left = window.innerWidth - tipRect.width - 10;

                tip.style.left = `${left}px`;
                tip.style.top = `${top + window.scrollY}px`;
            };

            buttons.forEach(btn => {
                const val = btn.dataset.val;

                btn.addEventListener('click', () => {
                    // Update Active Class
                    buttons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    // Update Hidden Input
                    hiddenInput.value = val;

                    // Update Context
                    document.getElementById(`val-${dimId}`).textContent = val;
                    updateLayerScores();
                    showTooltip(btn, val);
                });

                btn.addEventListener('mouseenter', () => showTooltip(btn, val));
                btn.addEventListener('mouseleave', hideTooltip);
            });
        });

        // Trigger initial calculation for default values
        updateLayerScores();
    }

    function updateLayerScores() {
        let totalScore = 0;

        // Calculate and display layer scores
        for (const [layerName, dims] of Object.entries(layers)) {
            let layerSum = 0;
            dims.forEach(dimId => {
                layerSum += parseInt(document.getElementById(dimId).value);
            });
            document.getElementById(`score-${layerName}`).textContent = (layerSum / dims.length).toFixed(1);
            totalScore += layerSum;
        }
    }

    // Load history on start
    renderHistoryList();

    function calculateAndShowResults() {
        const scenarioName = document.getElementById('scenarioName').value.trim();
        if (!scenarioName) {
            alert('请输入待评估的场景名称！');
            document.getElementById('scenarioName').focus();
            return;
        }

        // Ensure scores are calculated
        updateLayerScores();

        // Get individual values for the chart
        const dataValues = [];
        for (let i = 1; i <= 7; i++) {
            dataValues.push(parseInt(document.getElementById(`dim${i}`).value));
        }

        // Calculate Average Scores for Logic determination
        const scoreCognitive = getLayerAverage('cognitive');
        const scoreProcess = getLayerAverage('process');
        const scoreBenefit = getLayerAverage('benefit');
        const totalScore = dataValues.reduce((a, b) => a + b, 0);

        // Update Total Score Display
        document.getElementById('total-score').textContent = totalScore;

        // Determine Recommendation
        const recommendation = determineRecommendation(scoreCognitive, scoreProcess, scoreBenefit);
        displayRecommendation(recommendation);

        // Render Charts
        renderRadarChart(dataValues);
        renderQuadrantChart(scoreCognitive, scoreProcess, scoreBenefit);

        // Save to History
        saveEvaluation({
            name: scenarioName,
            date: new Date().toLocaleDateString('zh-CN'),
            total: totalScore,
            recommendation: recommendation.title,
            verdictReason: document.getElementById('ai-verdict').textContent || '',
            scores: ['dim1', 'dim2', 'dim3', 'dim4', 'dim5', 'dim6', 'dim7'].map(id => parseInt(document.getElementById(id).value))
        });

        // Show Results Section
        const resultSection = document.getElementById('result-section');
        resultSection.classList.remove('hidden');
        resultSection.scrollIntoView({ behavior: 'smooth' });
    }

    function saveEvaluation(data) {
        let history = JSON.parse(localStorage.getItem('agent_eval_history') || '[]');
        // Optional: Avoid duplicates for same name in one session
        history = history.filter(item => item.name !== data.name);
        history.unshift(data);
        localStorage.setItem('agent_eval_history', JSON.stringify(history.slice(0, 10))); // Keep last 10
        renderHistoryList();
    }

    window.loadEvaluation = function (index) {
        const history = JSON.parse(localStorage.getItem('agent_eval_history') || '[]');
        const data = history[index];
        if (!data) return;

        // Restore name
        document.getElementById('scenarioName').value = data.name;

        // Restore scores
        data.scores.forEach((val, i) => {
            const dimId = `dim${i + 1}`;
            document.getElementById(dimId).value = val;
            document.getElementById(`val-${dimId}`).textContent = val;

            // Update active button UI
            const selector = document.querySelector(`.score-selector[data-dim="${dimId}"]`);
            if (selector) {
                const buttons = selector.querySelectorAll('.score-btn');
                buttons.forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.dataset.val == val) btn.classList.add('active');
                });
            }
        });

        // Trigger Display
        calculateAndShowResults();
    };

    window.deleteEvaluation = function (index) {
        let history = JSON.parse(localStorage.getItem('agent_eval_history') || '[]');
        history.splice(index, 1);
        localStorage.setItem('agent_eval_history', JSON.stringify(history));
        renderHistoryList();
    };

    window.clearHistory = function () {
        if (confirm('确定要清空所有评估历史吗？')) {
            localStorage.removeItem('agent_eval_history');
            renderHistoryList();
        }
    };

    function renderHistoryList() {
        const historyList = document.getElementById('history-list');
        const history = JSON.parse(localStorage.getItem('agent_eval_history') || '[]');

        if (history.length === 0) {
            historyList.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">暂无历史记录</p>';
            return;
        }

        historyList.innerHTML = history.map((item, index) => `
        <div class="history-item">
            <div class="history-info">
                <h4>${item.name}</h4>
                <p>${item.date} | 总分: ${item.total} | <strong>${item.recommendation}</strong></p>
                ${item.verdictReason ? `<p class="history-verdict">${item.verdictReason.replace('AI 判词：', '')}</p>` : ''}
            </div>
            <div class="history-actions">
                <button type="button" class="secondary-btn" onclick="loadEvaluation(${index})">回看</button>
                <button type="button" class="secondary-btn" onclick="deleteEvaluation(${index})" style="color: var(--danger-color)">删除</button>
            </div>
        </div>
    `).join('');
    }

    function getLayerAverage(layerName) {
        const dims = layers[layerName];
        let sum = 0;
        dims.forEach(dimId => {
            sum += parseInt(document.getElementById(dimId).value);
        });
        return sum / dims.length;
    }

    function determineRecommendation(cognitive, process, benefit) {
        let result = {};

        // Logic thresholds: Low < 3.0, Medium [3.0, 4.0), High >= 4.0
        if (cognitive < 3) {
            result = {
                title: "不适合",
                desc: "建议保留为长期探索方向落地。",
                class: "status-danger"
            };
        } else if (cognitive >= 3 && cognitive < 4.0) {
            result = {
                title: "条件待完善",
                desc: "暂缓落地，需优化数据、流程或评估机制。",
                class: "status-warning"
            };
        } else {
            // Cognitive >= 4.0 (High)
            if (process < 4.0 && benefit < 3.0) {
                result = {
                    title: "通用场景",
                    desc: "不适合工作流构建，但适合使用通用Agent。",
                    class: "status-info"
                };
            } else if (process >= 4.0 && benefit < 3.0) {
                result = {
                    title: "实验场景",
                    desc: "可小范围实验，优先级P1。",
                    class: "status-info"
                };
            } else if (process >= 4.0 && benefit >= 3.0) {
                result = {
                    title: "高潜力场景",
                    desc: "流程成熟且效益清晰，优先级 P0。",
                    class: "status-success"
                };
            } else if (process < 4.0 && benefit >= 3.0) {
                // 认知高 + 业务中 + 效益高 → 也属于高潜力场景
                result = {
                    title: "高潜力场景",
                    desc: "效益价值已明确，可边落地边补完流程规范，优先级 P0。",
                    class: "status-success"
                };
            }
        }

        // Generate verdict
        const verdict = generateVerdict(cognitive, process, benefit);
        const verdictEl = document.getElementById('ai-verdict');
        verdictEl.textContent = "AI 判词：" + verdict;
        verdictEl.style.display = 'block';

        return result;
    }

    function generateVerdict(cognitive, process, benefit) {
        const feasibility = (cognitive + process) / 2;
        const value = benefit;

        if (feasibility >= 3 && value >= 3) {
            return "该场景属于【高价值高可行性】的明星项目，具备清晰的ROI和技术落地路径，建议优先立项并进行PoC验证。";
        } else if (feasibility < 3 && value >= 3) {
            return "该场景【业务价值高】但技术或流程可行性较低，建议作为战略探索方向，优先解决数据或流程标准化问题。";
        } else if (feasibility >= 3 && value < 3) {
            return "该场景【可行性高】但业务价值尚不显著，建议作为战术补充工具快速落地，或重新挖掘业务价值点。";
        } else {
            return "该场景当前【可行性与价值均较低】，建议暂缓投入，持续关注技术发展或业务瓶颈的变化。";
        }
    }

    function displayRecommendation(rec) {
        const titleEl = document.getElementById('recommendation-title');
        const descEl = document.getElementById('recommendation-desc');
        titleEl.textContent = rec.title;
        titleEl.className = 'rec-title ' + rec.class;
        descEl.textContent = rec.desc;
    }

    function renderRadarChart(data) {
        const ctx = document.getElementById('radarChart').getContext('2d');
        if (radarChart) radarChart.destroy();
        radarChart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: dimensionLabels,
                datasets: [{
                    label: '场景评估维度得分',
                    data: data,
                    fill: true,
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    pointBackgroundColor: 'rgba(59, 130, 246, 1)',
                    pointBorderColor: '#fff'
                }]
            },
            options: {
                scales: {
                    r: {
                        angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                        grid: { color: 'rgba(255, 255, 255, 0.2)' },
                        pointLabels: { color: '#94a3b8' },
                        ticks: {
                            backdropColor: 'transparent',
                            color: 'rgba(255, 255, 255, 0.5)',
                            min: 0,
                            max: 5,
                            stepSize: 1
                        },
                        suggestedMin: 0,
                        suggestedMax: 5
                    }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    function renderQuadrantChart(cognitive, process, benefit) {
        const ctx = document.getElementById('quadrantChart').getContext('2d');
        const x = (cognitive + process) / 2; // 可行性
        const y = benefit; // 业务价值

        if (quadrantChartInstance) quadrantChartInstance.destroy();
        quadrantChartInstance = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: '当前场景',
                    data: [{ x: x, y: y }],
                    backgroundColor: '#3b82f6',
                    borderColor: '#fff',
                    borderWidth: 2,
                    pointRadius: 10,
                    pointHoverRadius: 12
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom',
                        min: 1,
                        max: 5.5, // Added padding
                        title: {
                            display: true,
                            text: '可行性',
                            color: '#94a3b8',
                            font: { size: 14, weight: '600' }
                        },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: {
                            color: '#94a3b8',
                            stepSize: 1,
                            callback: function (value) { return value > 5 ? '' : value; }
                        }
                    },
                    y: {
                        type: 'linear',
                        min: 1,
                        max: 5.5, // Added padding
                        title: {
                            display: true,
                            text: '业务价值',
                            color: '#94a3b8',
                            font: { size: 14, weight: '600' }
                        },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: {
                            color: '#94a3b8',
                            stepSize: 1,
                            callback: function (value) { return value > 5 ? '' : value; }
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => `可行性: ${context.raw.x.toFixed(2)}, 价值: ${context.raw.y.toFixed(2)}`
                        }
                    }
                }
            },
            plugins: [{
                id: 'quadrantLabels',
                beforeDraw: (chart) => {
                    const { ctx, chartArea: { top, bottom, left, right }, scales: { x, y } } = chart;
                    const centerX = x.getPixelForValue(3);
                    const centerY = y.getPixelForValue(3);

                    ctx.save();

                    // Draw Quadrant Lines
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
                    ctx.setLineDash([]); // Thick solid lines
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(centerX, top); ctx.lineTo(centerX, bottom);
                    ctx.moveTo(left, centerY); ctx.lineTo(right, centerY);
                    ctx.stroke();

                    // Draw Arrows
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                    // X-axis arrow (Right)
                    ctx.beginPath();
                    ctx.moveTo(right, centerY);
                    ctx.lineTo(right - 10, centerY - 5);
                    ctx.lineTo(right - 10, centerY + 5);
                    ctx.fill();
                    // Y-axis arrow (Up)
                    ctx.beginPath();
                    ctx.moveTo(centerX, top);
                    ctx.lineTo(centerX - 5, top + 10);
                    ctx.lineTo(centerX + 5, top + 10);
                    ctx.fill();

                    // Draw Quadrant Text
                    ctx.font = 'bold 12px Inter';
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                    ctx.textAlign = 'center';

                    // Q1: Top-Right
                    ctx.fillText('优先落地 (Stars)', x.getPixelForValue(4.2), y.getPixelForValue(4.2));
                    // Q2: Top-Left
                    ctx.fillText('战略探索 (Question Marks)', x.getPixelForValue(1.8), y.getPixelForValue(4.2));
                    // Q3: Bottom-Left
                    ctx.fillText('暂缓放弃 (Dogs)', x.getPixelForValue(1.8), y.getPixelForValue(1.8));
                    // Q4: Bottom-Right
                    ctx.fillText('战术补充 (Cash Cows)', x.getPixelForValue(4.2), y.getPixelForValue(1.8));

                    ctx.restore();
                }
            }]
        });
    }

    window.exportReport = function () {
        const { jsPDF } = window.jspdf;

        // Create a hidden container for the full report
        const reportContainer = document.createElement('div');
        reportContainer.className = 'report-export-container';
        reportContainer.style.position = 'fixed';
        reportContainer.style.left = '-9999px';
        reportContainer.style.width = '800px';
        reportContainer.style.padding = '40px';
        reportContainer.style.background = '#0f172a';
        reportContainer.style.color = '#f8fafc';
        reportContainer.style.fontFamily = 'Inter, sans-serif';

        // 1. Header
        const scenarioName = document.getElementById('scenarioName').value || '未命名场景';
        const header = document.createElement('div');
        header.innerHTML = `
            <h1 style="color: #3b82f6; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">场景评估详细报告</h1>
            <h2 style="color: #f8fafc; margin-top: 15px;">评估对象：${scenarioName}</h2>
            <p style="color: #94a3b8;">生成时间：${new Date().toLocaleString()}</p>
        `;
        reportContainer.appendChild(header);

        // 2. Summary & Verdict
        const summary = document.createElement('div');
        summary.style.margin = '20px 0';
        summary.style.padding = '20px';
        summary.style.background = 'rgba(255,255,255,0.05)';
        summary.style.borderRadius = '10px';
        summary.innerHTML = `
            <h2 style="margin-top:0">评估结论：${document.getElementById('recommendation-title').textContent}</h2>
            <p>${document.getElementById('recommendation-desc').textContent}</p>
            <p style="font-style: italic; color: #a5b4fc;">${document.getElementById('ai-verdict').textContent}</p>
            <h3 style="color: #3b82f6">总得分：${document.getElementById('total-score').textContent} / 35</h3>
        `;
        reportContainer.appendChild(summary);

        // 3. Scoring Detail Table
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.margin = '20px 0';
        let tableHTML = `
            <tr style="background: rgba(59,130,246,0.2)">
                <th style="padding: 10px; border: 1px solid rgba(255,255,255,0.1); text-align: left;">评估维度</th>
                <th style="padding: 10px; border: 1px solid rgba(255,255,255,0.1); text-align: center;">分值</th>
            </tr>
        `;

        dimensionLabels.forEach((label, index) => {
            const val = document.getElementById(`dim${index + 1}`).value;
            tableHTML += `
                <tr>
                    <td style="padding: 10px; border: 1px solid rgba(255,255,255,0.1);">${label}</td>
                    <td style="padding: 10px; border: 1px solid rgba(255,255,255,0.1); text-align: center; font-weight: bold;">${val}</td>
                </tr>
            `;
        });
        table.innerHTML = tableHTML;
        reportContainer.appendChild(table);

        // 4. Charts Snapshot
        const chartsRow = document.createElement('div');
        chartsRow.style.display = 'flex';
        chartsRow.style.gap = '20px';
        chartsRow.style.marginTop = '20px';

        // Clone Radar Chart
        const radarCanvas = document.createElement('canvas');
        radarCanvas.width = 380;
        radarCanvas.height = 380;
        chartsRow.appendChild(radarCanvas);

        // Clone Quadrant Chart
        const quadrantCanvas = document.createElement('canvas');
        quadrantCanvas.width = 380;
        quadrantCanvas.height = 380;
        chartsRow.appendChild(quadrantCanvas);

        reportContainer.appendChild(chartsRow);

        document.body.appendChild(reportContainer);

        // Render clones for export
        const rCtx = radarCanvas.getContext('2d');
        const qCtx = quadrantCanvas.getContext('2d');

        // Copy original canvas contents
        rCtx.drawImage(document.getElementById('radarChart'), 0, 0, 380, 380);
        qCtx.drawImage(document.getElementById('quadrantChart'), 0, 0, 380, 380);

        html2canvas(reportContainer, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#0f172a'
        }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Agent场景评估完整报告_${new Date().toISOString().slice(0, 10)}.pdf`);

            document.body.removeChild(reportContainer);
        });
    };

    function resetForm() {
        // Reset Logic
        window.location.reload();
    }

    // 2.0: File Upload Logic
    const fileInput = document.getElementById('fileInput');
    const fileStatus = document.getElementById('fileStatus');
    const analysisProgress = document.getElementById('analysisProgress');
    const fileNameDisplay = fileStatus.querySelector('.file-name');

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFile(e.target.files[0]);
    });

    document.getElementById('removeFile').addEventListener('click', () => {
        fileInput.value = '';
        fileStatus.classList.add('hidden');
    });

    // --- Chat & AI Interaction Logic ---

    // Global Chat State
    let chatHistory = [];
    const systemPrompt = `你内置了一套用于验证 AI Agent 业务场景可行性与投入产出比（ROI）的严谨协议。
当你从用户处收集到足够的业务场景需求后，你必须顺序执行协议。

## 步骤 0: 信息完备性诊断与强制追问机制 (Gatekeeper)
在你开始对任何维度进行打分或执行后续步骤前，你必须静默核对用户当前提供的信息是否足以支撑对下面 7 个维度的准确判断。
1. **绝对禁止脑补**：严禁在信息缺失的情况下自行假设用户的业务细节。
2. **阻断原则**：如果发现有任何 1 个维度的信息无法确认，停止执行后续打分步骤，直接向用户发问。
3. **发起顾问式连问**：立即切换为对客回复模式。抛出 2-3 个高度相关的业务问题，要求用户进一步明确场景细节。
4. **循环直至完备**：只有当所有维度的背景信息都已被点亮，你才能正式触发步骤3输出 JSON 结果。

## 步骤 1: 针对 7 个维度进行评分 (1-5 分制)
[dim1] 语言与理解复杂度: 5分=高推理, 3分=半理解, 1分=纯计算或流程
[dim2] 模型擅长领域匹配: 5分=强项, 3分=延伸, 1分=弱向
[dim3] 业务规范与流程成熟度: 5分=长期稳定SOP, 3分=方向大概有需补充, 1分=毫无规范
[dim4] 上下文与知识完备性: 5分=数据全且直通API, 3分=有但待清洗, 1分=缺失
[dim5] 容错性与人机协作机制: 5分=高容错/人工审查好, 3分=中等, 1分=出错代价致命
[dim6] ROI 清晰度: 5分=极清晰量化, 3分=粗估, 1分=很难算或者很低
[dim7] 结果可评估性: 5分=有明确指标定好坏, 3分=部分主观, 1分=毫无标准主观

## 步骤 2: 矩阵推论算平均分 (Cognitive, Process, Benefit)
- 强行否决规则: Cognitive_Avg < 3.0 -> 【不适合】
- 条件不准入: 3.0 <= Cognitive < 4.0 -> 【条件待完善】
- 进入高认知 (Cognitive >= 4.0)
  * Process < 4.0 & Benefit < 3.0 -> 【通用场景】
  * Process >= 4.0 & Benefit < 3.0 -> 【实验场景】
  * Process >= 4.0 & Benefit >= 3.0 -> 【高潜力场景】
  * 其他 -> 【需进一步评估】

## 步骤 3: 结构化输出结果
当你认为所有信息收集完毕，**已经完成了最终打分评估后**，你只需输出 JSON。不要再包含聊天废话。
必须输出符合如下结构的纯 JSON:
{
  "scores": { "dim1": 4, "dim2": 5, "dim3": 3, "dim4": 4, "dim5": 5, "dim6": 2, "dim7": 3 },
  "tier_averages": { "cognitive_avg": 4.5, "process_avg": 3.5, "benefit_avg": 3.33 },
  "verdict_title": "在此填入步骤2的最终判词",
  "verdict_reason": "在此填入大概50字的详细理由解释..."
}`;

    chatHistory.push({ role: 'system', content: systemPrompt });

    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const chatMessages = document.getElementById('chatMessages');

    function addMessageToUI(role, content) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}`;
        msgDiv.innerHTML = content.replace(/\n/g, '<br>');
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    sendBtn.addEventListener('click', () => handleSendMessage());
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    // New Evaluation button: reset everything
    document.getElementById('newEvalBtn').addEventListener('click', () => {
        if (!confirm('确认开启新的评估？当前对话将被清空。')) return;

        // Reset chat history & UI
        chatHistory = [{ role: 'system', content: systemPrompt }];
        chatMessages.innerHTML = '';
        addMessageToUI('ai', '您好，我是企业 Agent 场景落地咨询顾问。请问您所在团队目前想尝试用 AI 解决什么具体的业务难题？');

        // Hide results, show placeholder
        document.getElementById('evaluationForm').classList.add('hidden');
        document.getElementById('result-section').classList.add('hidden');
        document.getElementById('resultPlaceholder').classList.remove('hidden');

        // Clear scenario name
        document.getElementById('scenarioName').value = '';
        chatInput.value = '';
    });

    async function handleFile(file) {
        fileStatus.classList.remove('hidden');
        fileNameDisplay.textContent = file.name;

        // Auto-fill scenario name if empty
        const scenarioInput = document.getElementById('scenarioName');
        if (!scenarioInput.value) {
            scenarioInput.value = file.name.replace(/\.[^/.]+$/, "");
        }

        try {
            analysisProgress.classList.remove('hidden');
            const fill = analysisProgress.querySelector('.progress-fill');
            const txt = analysisProgress.querySelector('.progress-text');
            fill.style.width = '50%';
            txt.textContent = '正在读取文件内容...';

            const text = await extractTextFromFile(file);
            fill.style.width = '100%';
            txt.textContent = '读取完毕，已发送至顾问';

            setTimeout(() => {
                analysisProgress.classList.add('hidden');
            }, 800);

            // Add system message showing read transparency
            const charCount = text.length;
            const truncated = charCount > 4000;
            const systemMsgDiv = document.createElement('div');
            systemMsgDiv.className = 'message system-msg';
            systemMsgDiv.textContent = `📎 已读取文件【${file.name}】，共 ${charCount.toLocaleString()} 个字符${truncated ? '，已截取前 4000 字符发送给顾问分析' : ''}。`;
            chatMessages.appendChild(systemMsgDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;

            // Send to chat
            const fileContextMsg = `[用户上传了需求文件，内容如下，基于此提取信息：]\n\n${text.substring(0, 4000)}${truncated ? '...' : ''}`;
            handleSendMessage(fileContextMsg, `【📁 已上传文档: ${file.name}】`);

        } catch (error) {
            console.error('File error:', error);
            alert('文件解析失败，请尝试上传其他格式或手动输入。');
            analysisProgress.classList.add('hidden');
        }
    }

    async function extractTextFromFile(file) {
        const extension = file.name.split('.').pop().toLowerCase();
        if (extension === 'txt') {
            return await file.text();
        } else if (extension === 'pdf') {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                fullText += content.items.map(item => item.str).join(' ');
            }
            return fullText;
        } else if (extension === 'docx' || extension === 'doc') {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            return result.value;
        }
        throw new Error('Unsupported file format');
    }

    async function handleSendMessage(internalText = null, displayText = null) {
        const textToSend = internalText || chatInput.value.trim();
        const textToDisplay = displayText || textToSend;

        if (!textToSend) return;

        chatInput.value = '';
        addMessageToUI('user', textToDisplay);
        chatHistory.push({ role: 'user', content: textToSend });

        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'message ai loading';
        loadingDiv.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
        chatMessages.appendChild(loadingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        try {
            // Use full URL for local development (Flask on port 3000), and relative path for Vercel production
            const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:')
                ? 'http://localhost:3000/api/chat'
                : '/api/chat';

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messages: chatHistory
                })
            });

            chatMessages.removeChild(loadingDiv);

            if (!response.ok) {
                let errMsg = 'HTTP错误';
                try {
                    const errorData = await response.json();
                    if (errorData.error) {
                        errMsg = errorData.error;
                    }
                } catch (e) {
                    errMsg = `HTTP请求失败: ${response.status}`;
                }
                throw new Error(errMsg);
            }

            const data = await response.json();
            const aiRawOutput = data.choices[0]?.message?.content || "";
            chatHistory.push({ role: 'assistant', content: aiRawOutput });

            // Detect JSON - robustly find the object containing "scores" key,
            // ignoring inline non-JSON fragments like {dim1:5, dim2:4...}
            let parsedJson = null;
            try {
                const scoresIdx = aiRawOutput.lastIndexOf('"scores"');
                if (scoresIdx !== -1) {
                    // Walk backwards to find the opening {
                    let start = scoresIdx;
                    while (start >= 0 && aiRawOutput[start] !== '{') start--;
                    if (start >= 0) {
                        // Walk forward to find the matching closing }
                        let depth = 0, end = start;
                        for (let i = start; i < aiRawOutput.length; i++) {
                            if (aiRawOutput[i] === '{') depth++;
                            else if (aiRawOutput[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
                        }
                        parsedJson = JSON.parse(aiRawOutput.slice(start, end + 1));
                    }
                }
            } catch (e) {
                // Fallback to original greedy match
                try {
                    const jsonMatch = aiRawOutput.match(/\{[\s\S]*\}/);
                    if (jsonMatch) parsedJson = JSON.parse(jsonMatch[0]);
                } catch (e2) { }
            }

            if (parsedJson && parsedJson.scores && parsedJson.verdict_title) {
                addMessageToUI('ai', `信息收集完毕！<br><br>评估分析完成。结果已生成并展示在右侧面板。`);

                // Hide placeholder, show ONLY result-section (not the full 7-dim form)
                const placeholder = document.getElementById('resultPlaceholder');
                const resultSection = document.getElementById('result-section');
                if (placeholder) placeholder.classList.add('hidden');
                if (resultSection) resultSection.classList.remove('hidden');
                // evaluationForm stays hidden - scores applied internally for chart computation

                // Render logic
                applyScores(parsedJson.scores);

                const verdictEl = document.getElementById('ai-verdict');
                if (verdictEl) {
                    verdictEl.innerHTML = `<strong>${parsedJson.verdict_title}</strong>: ${parsedJson.verdict_reason}`;
                    verdictEl.style.display = 'block';
                }

                document.getElementById('recommendation-title').textContent = parsedJson.verdict_title;
                document.getElementById('recommendation-desc').textContent = parsedJson.verdict_reason;

                calculateAndShowResults();
            } else {
                addMessageToUI('ai', aiRawOutput);
            }

        } catch (error) {
            console.error('Chat Error:', error);
            if (chatMessages.contains(loadingDiv)) chatMessages.removeChild(loadingDiv);
            addMessageToUI('ai', 'API 接口调用失败：' + error.message);

            // Allow manual fallback UI to appear
            const rightPanelForm = document.getElementById('evaluationForm');
            if (rightPanelForm) rightPanelForm.classList.remove('hidden');
        }
    }

    function fallbackScoring(text) {
        const textLower = text.toLowerCase();
        const scoringRules = [
            { id: 'dim1', keywords: ['推理', '法律', '复杂', '语义', '合同', '理由', '理解', 'logic', 'reasoning'] },
            { id: 'dim2', keywords: ['客服', '写作', '文案', '代码', '总结', '提取', 'chat', 'content', 'summarize'] },
            { id: 'dim3', keywords: ['sop', '流程', '规范', '步骤', '说明书', '手册', 'procedure', 'standard'] },
            { id: 'dim4', keywords: ['知识库', '数据库', '文档', '参考', '记录', '数据', 'knowledge', 'data'] },
            { id: 'dim5', keywords: ['复核', '审核', '人机', '配合', '重试', '纠错', 'review', 'approval', 'human'] },
            { id: 'dim6', keywords: ['节省', '增效', '成本', '频率', '用户', '量化', 'roi', 'saving', 'efficiency'] },
            { id: 'dim7', keywords: ['准确率', '满意度', '指标', '对错', '标准', '评估', 'metric', 'accuracy'] }
        ];

        const scores = {};
        scoringRules.forEach(rule => {
            let matches = 0;
            rule.keywords.forEach(kw => {
                if (textLower.includes(kw)) matches++;
            });
            if (matches >= 4) scores[rule.id] = 5;
            else if (matches >= 2) scores[rule.id] = 4;
            else if (matches >= 1) scores[rule.id] = 3;
            else scores[rule.id] = 2;
        });
        return scores;
    }

    function applyScores(scores) {
        for (const [dimId, val] of Object.entries(scores)) {
            const hiddenInput = document.getElementById(dimId);
            if (hiddenInput) {
                hiddenInput.value = val;
                document.getElementById(`val-${dimId}`).textContent = val;

                // Update UI buttons
                const selector = document.querySelector(`.score-selector[data-dim="${dimId}"]`);
                if (selector) {
                    const buttons = selector.querySelectorAll('.score-btn');
                    buttons.forEach(btn => {
                        btn.classList.remove('active');
                        if (btn.dataset.val == val) btn.classList.add('active');
                    });
                }
            }
        }
        updateLayerScores();
    }

    // Modal Logic
    const modal = document.getElementById("imageModal");
    const img = document.querySelector(".zoomable-img");
    const modalImg = document.getElementById("imgFull");

    if (img) {
        img.onclick = function () {
            modal.style.display = "block";
            modalImg.src = this.src;
        }
    }

    const span = document.getElementsByClassName("close")[0];
    if (span) {
        span.onclick = function () {
            modal.style.display = "none";
        }
    }

    window.onclick = function (event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }
});
