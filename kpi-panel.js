(function() {
    "use strict";

    // =================================================================================
    // PART 1: BUILDER PANEL (Design Mode)
    // =================================================================================
    
    const builderTemplate = document.createElement("template");
    builderTemplate.innerHTML = `
        <style>
            :host {
                display: block;
                padding: 15px;
                font-family: "72", "Segoe UI", Arial, sans-serif;
            }
            label {
                display: block;
                margin-bottom: 8px;
                font-size: 12px;
                font-weight: bold;
                color: #333;
            }
            textarea {
                width: 100%;
                height: 150px;
                padding: 8px;
                border: 1px solid #ccc;
                border-radius: 4px;
                box-sizing: border-box;
                font-size: 12px;
                font-family: monospace;
                resize: vertical;
            }
            button {
                background-color: #0a6ed1;
                color: white;
                border: none;
                padding: 10px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
                width: 100%;
                font-weight: bold;
                margin-top: 10px;
            }
            button:hover {
                background-color: #0854a0;
            }
            .hint {
                font-size: 11px;
                color: #666;
                margin-top: 5px;
            }
        </style>
        <form id="form">
            <label for="kpi_data">KPI JSON Data</label>
            <textarea id="kpi_data" placeholder='[{"title":"Revenue", "value":30.3, ...}]'></textarea>
            <button type="submit">Update Widget</button>
            <div class="hint">Paste your JSON configuration here.</div>
        </form>
    `;

    class KPIPanelBuilder extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({ mode: "open" });
            this.shadowRoot.appendChild(builderTemplate.content.cloneNode(true));
        }

        connectedCallback() {
            this.shadowRoot.getElementById("form").addEventListener("submit", this._submit.bind(this));
        }

        _submit(e) {
            e.preventDefault();
            this.dispatchEvent(new CustomEvent("propertiesChanged", {
                detail: {
                    properties: {
                        kpiData: this.kpiData
                    }
                }
            }));
        }

        get kpiData() {
            return this.shadowRoot.getElementById("kpi_data").value;
        }

        set kpiData(val) {
            this.shadowRoot.getElementById("kpi_data").value = val;
        }
    }

    // =================================================================================
    // PART 2: MAIN WIDGET (Runtime & Canvas)
    // =================================================================================

    const widgetTemplate = document.createElement("template");
    widgetTemplate.innerHTML = `
        <style>
            :host {
                display: block;
                font-family: '72', 'Segoe UI', Arial, sans-serif;
                width: 100%;
                height: 100%;
            }
            
            /* Container for the row of cards */
            .kpi-row-container {
                display: flex;
                flex-direction: row;
                height: 100%;
                width: 100%;
                gap: 20px;
                overflow-x: auto; /* Allow scrolling if too many cards */
                padding: 5px;
                box-sizing: border-box;
                background: white;
            }

            /* Individual Card Styling */
            .kpi-card {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                min-width: 180px;
                text-align: center;
                position: relative;
                cursor: pointer;
                transition: transform 0.2s;
            }
            
            .kpi-card:hover {
                transform: translateY(-2px);
            }

            /* 1. Title */
            .card-title {
                font-size: 14px;
                color: #333;
                font-weight: 600;
                margin-bottom: 5px;
            }

            /* 2. Main Value */
            .card-value-group {
                font-size: 24px;
                font-weight: 400; /* As per image, not super bold */
                margin-bottom: 8px;
                display: flex;
                align-items: center;
                gap: 5px;
            }
            .symbol { font-size: 20px; font-weight: bold; }

            /* Color States */
            .status-success { color: #2e7d32; } /* Green */
            .status-error { color: #d32f2f; }   /* Red */

            /* 3. Budget Box */
            .budget-box {
                font-size: 11px;
                padding: 4px 10px;
                border-radius: 4px;
                margin-bottom: 8px;
                white-space: nowrap;
                font-weight: 500;
            }
            .bg-success { background-color: #f1f8e9; color: #33691e; }
            .bg-error { background-color: #ffebee; color: #b71c1c; }

            /* 4. PY Text */
            .py-text {
                font-size: 11px;
                color: #666;
                margin-bottom: 15px;
            }
            .arrow-up { font-size: 10px; }

            /* 5. Sparkline */
            .sparkline-container {
                width: 100%;
                height: 40px;
                display: flex;
                align-items: flex-end;
                justify-content: space-between;
                gap: 2px;
                margin-top: auto; /* Pushes chart to bottom */
            }
            .bar {
                background-color: #bdbdbd;
                flex: 1;
                border-radius: 1px;
                transition: height 0.5s ease;
                min-width: 2px;
            }
            .bar:hover { background-color: #757575; }

            /* Tooltip */
            #tooltip {
                position: fixed;
                background: rgba(0, 0, 0, 0.85);
                color: white;
                padding: 6px 10px;
                border-radius: 4px;
                font-size: 11px;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.2s;
                z-index: 9999;
            }
        </style>
        
        <div class="kpi-row-container" id="container">
            <!-- Cards will be injected here -->
        </div>
        <div id="tooltip"></div>
    `;

    class KPIPanelWidget extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({ mode: "open" });
            this.shadowRoot.appendChild(widgetTemplate.content.cloneNode(true));
            this._props = {
                kpiData: [] 
            };
        }

        onCustomWidgetBeforeUpdate(changedProperties) {
            this._props = { ...this._props, ...changedProperties };
        }

        onCustomWidgetAfterUpdate(changedProperties) {
            if ("kpiData" in changedProperties) {
                this.render();
            }
        }

        connectedCallback() {
            // Render default if empty
            if(!this._props.kpiData || this._props.kpiData.length === 0) {
                 // For testing/preview purposes if no data is passed
                 // In production, you might want to leave this empty
            }
        }

        render() {
            const container = this.shadowRoot.getElementById("container");
            const rawData = this._props.kpiData;
            
            let data = [];
            try {
                if (typeof rawData === "string") {
                    data = JSON.parse(rawData);
                } else {
                    data = rawData;
                }
            } catch (e) {
                container.innerHTML = `<div style="color:red; padding:10px">Invalid JSON Data</div>`;
                return;
            }

            if (!data || data.length === 0) {
                container.innerHTML = `<div style="padding:10px; color:#999">No KPI Data Configured</div>`;
                return;
            }

            // Clear previous content
            container.innerHTML = "";

            data.forEach((item, index) => {
                // Determine Colors based on status
                // Status can be "success" (green) or "error" (red)
                const isError = item.status === "error";
                const colorClass = isError ? "status-error" : "status-success";
                const bgClass = isError ? "bg-error" : "bg-success";
                const symbol = isError ? "!" : "✓";

                // Sparkline Generation
                let sparklineHtml = "";
                if (item.trend && Array.isArray(item.trend)) {
                    // Normalize heights relative to the max value in the series
                    const maxVal = Math.max(...item.trend, 1); // Avoid div by zero
                    sparklineHtml = item.trend.map(val => {
                        const height = (val / maxVal) * 100;
                        return `<div class="bar" style="height: ${height}%;" title="${val}"></div>`;
                    }).join("");
                }

                // Create Card Element
                const card = document.createElement("div");
                card.className = "kpi-card";
                card.dataset.index = index; // Store index for click event
                
                card.innerHTML = `
                    <div class="card-title">${item.title}</div>
                    
                    <div class="card-value-group ${colorClass}">
                        <span>${item.value}${item.unit}</span>
                        <span class="symbol">${symbol}</span>
                    </div>
                    
                    <div class="budget-box ${bgClass}">
                        Budget: ${item.budget}${item.unit} (+${item.budgetPct}%)
                    </div>
                    
                    <div class="py-text">
                        PY: ${item.py}${item.unit} (<span class="arrow-up">▲</span> ${item.pyChange}${item.unit} | ${item.pyPct}%)
                    </div>
                    
                    <div class="sparkline-container">
                        ${sparklineHtml}
                    </div>
                `;

                // Add Click Event
                card.addEventListener("click", () => {
                    this.dispatchEvent(new CustomEvent("onCardClick", {
                        detail: item // Pass the whole item object back to SAC
                    }));
                });

                container.appendChild(card);
            });
            
            // Re-attach tooltip logic to new sparklines
            this._addInteractivity();
        }

        _addInteractivity() {
            const tooltip = this.shadowRoot.getElementById("tooltip");
            const bars = this.shadowRoot.querySelectorAll(".bar");

            bars.forEach(bar => {
                bar.addEventListener("mouseenter", (e) => {
                    tooltip.innerText = `Value: ${e.target.title}`;
                    tooltip.style.opacity = "1";
                });

                bar.addEventListener("mousemove", (e) => {
                    tooltip.style.left = (e.clientX + 10) + "px";
                    tooltip.style.top = (e.clientY - 25) + "px";
                });

                bar.addEventListener("mouseleave", () => {
                    tooltip.style.opacity = "0";
                });
            });
        }

        // SAC Scripting Methods
        setKPIData(newData) {
            this.render(newData); // render will handle parsing
        }
    }

    // =================================================================================
    // PART 3: REGISTRATION
    // =================================================================================
    customElements.define("kpi-panel-widget", KPIPanelWidget);
    customElements.define("kpi-panel-builder", KPIPanelBuilder);

})();