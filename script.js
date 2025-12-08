// Setup Scrollama
const scroller = scrollama();
const scrollerComplexity = scrollama();

// Select elements
const main = d3.select("main");
const scrolly = main.select("#scrolly");
const figure = scrolly.select("figure");
const article = scrolly.select("article");
const step = article.selectAll(".step");

const scrollyComplexity = main.select("#scrolly-complexity");
const figureComplexity = scrollyComplexity.select("figure");
const articleComplexity = scrollyComplexity.select("article");
const stepComplexity = articleComplexity.selectAll(".step");

// Initialize
function init() {
    // 1. Force a resize on load to ensure proper dimensions
    handleResize();

    // 2. Setup the scroller
    scroller
        .setup({
            step: "#scrolly article .step",
            offset: 0.5, // Trigger when element is 50% down the screen
            debug: false // Set to true to see trigger lines
        })
        .onStepEnter(handleStepEnter);

    scrollerComplexity
        .setup({
            step: "#scrolly-complexity article .step",
            offset: 0.5,
            debug: false
        })
        .onStepEnter(handleStepEnterComplexity);

    // 3. Setup resize listener
    window.addEventListener("resize", handleResize);

    // 4. Load Data
    d3.json("./data/games_processed.json")
        .then(data => {
            console.log("Data loaded:", data.length, "games");

            // Initial Chart Render
            renderChart(data);
            renderComplexityChart(data);
            initBuilder(data);

            // Initialize Quiz
            initQuiz(data);
        })
        .catch(err => {
            console.error("Data loading failed:", err);
            showError();
        });
}

function showError() {
    const errorHTML = `
        <div class="error-message">
            <h3>⚠️ Data Loading Failed</h3>
            <p>This is likely a browser security restriction (CORS) because you opened the file directly.</p>
            <p>To fix this, you need to run a local server:</p>
            <ol style="text-align:left">
                <li>Open Terminal</li>
                <li>Go to the project folder</li>
                <li>Run: <code>./start_server.sh</code> or <code>python3 -m http.server</code></li>
                <li>Go to <a href="http://localhost:8000">localhost:8000</a></li>
            </ol>
        </div>
    `;
    d3.select("#vis-container").html(errorHTML);
    d3.select("#vis-complexity").html(errorHTML);
}

// Scroll Event Handler
function handleStepEnter(response) {
    console.log("Step:", response.index);

    // Response.index tells us which step we are on (0, 1, 2...)
    // We can use this to update the chart
    updateChart(response.index);

    // Update active class for styling
    step.classed("is-active", function (d, i) {
        return i === response.index;
    });
}

function handleStepEnterComplexity(response) {
    console.log("Complexity Step:", response.index);
    updateComplexityChart(response.index);
    stepComplexity.classed("is-active", (d, i) => i === response.index);
}

// Resize Handler
function handleResize() {
    // 1. Update height of step elements
    const stepH = Math.floor(window.innerHeight * 0.50);
    step.style("height", stepH + "px");
    stepComplexity.style("height", stepH + "px");

    // 2. Update height of graphic element
    const figureHeight = window.innerHeight;
    const figureMarginTop = (window.innerHeight - figureHeight) / 2;

    figure
        .style("height", figureHeight + "px")
        .style("top", figureMarginTop + "px");

    figureComplexity
        .style("height", figureHeight + "px")
        .style("top", figureMarginTop + "px");

    // 3. Tell scrollama to update new element dimensions
    scroller.resize();
    scrollerComplexity.resize();
}

// --- Visualization Logic ---

// Global state for data
let globalData = [];
let mechanicsByYear = [];
let allMechanics = {};

function renderChart(data) {
    globalData = data;

    // Process data for Mechanics Evolution
    // We want to see the rise of specific mechanics: 'Dice Rolling', 'Hand Management', 'Worker Placement', 'Cooperative Game'
    const topMechanics = ['Dice Rolling', 'Hand Management', 'Cooperative Game', 'Deck, Bag, and Pool Building', 'Area Majority / Influence'];

    // Group by year and count mechanics
    const years = d3.group(data, d => d.year);

    mechanicsByYear = Array.from(years, ([year, games]) => {
        const counts = {};
        topMechanics.forEach(m => counts[m] = 0);

        games.forEach(game => {
            game.mechanics.forEach(m => {
                if (topMechanics.includes(m)) {
                    counts[m]++;
                }
            });
        });

        // collect game names for this year
        const gameNames = games.map(g => g.name);

        // Normalize by total games that year? Or raw count? 
        // Raw count shows growth of industry, Percentage shows trend preference.
        // Right now, I'm doing raw count instead of percentage -- seems better.
        const result = {
            year,
            games: gameNames
        };
        topMechanics.forEach(m => {
            // result[m] = totalGames > 0 ? (counts[m] / totalGames) : 0; // normalized
            result[m] = counts[m]; // raw count
        });
        return result;
    }).sort((a, b) => a.year - b.year);

    // Setup SVG
    const container = d3.select("#vis-container");
    const width = container.node().getBoundingClientRect().width;
    const height = container.node().getBoundingClientRect().height;
    const margin = { top: 20, right: 200, bottom: 30, left: 100 };

    // Clear previous
    container.html("");

    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Scales
    const x = d3.scaleLinear()
        .domain(d3.extent(mechanicsByYear, d => d.year))
        .range([0, width - margin.left - margin.right]);

    // 
    const y = d3.scaleLinear()
        .domain([
            0,
            d3.max(mechanicsByYear, d =>
            d3.max(topMechanics, m => d[m])
            )
        ])
        .range([height - margin.top - margin.bottom, 0]);


    // const y = d3.scaleLinear()
    //      .domain([0, 1]) // 100%
    //     .range([height - margin.top - margin.bottom, 0]);

    const color = d3.scaleOrdinal()
        .domain(topMechanics)
        .range(["#ff4d4d", "#4da6ff", "#ffd700", "#00cc66", "#ff99cc"]); // Bright colors

    // Axes
    svg.append("g")
        .attr("transform", `translate(0, ${height - margin.top - margin.bottom})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")));

    svg.append("g")
        .call(d3.axisLeft(y));

    // Lines
    topMechanics.forEach(mech => {
        const line = d3.line()
            .curve(d3.curveBasis) // Smooth lines
            .x(d => x(d.year))
            .y(d => y(d[mech]));

        svg.append("path")
            .datum(mechanicsByYear)
            .attr("fill", "none")
            .attr("stroke", color(mech))
            .attr("stroke-width", 2)
            .attr("class", "line-mech")
            .attr("id", "line-" + mech.replace(/[^a-zA-Z]/g, "")) // Clean ID
            .attr("d", line);
        
        // add POINTS (this is the new part)
        svg.selectAll(".dot-" + mech.replace(/[^a-zA-Z]/g, ""))
            .data(mechanicsByYear)
            .enter()
            .append("circle")
            .attr("id", mech)
            .attr("class", "line-point")
            .attr("cx", d => x(d.year))
            .attr("cy", d => y(d[mech]))
            .attr("r", 4)
            .attr("fill", color(mech))
            .attr("opacity", 0);

        // Label at the end
        const lastPoint = mechanicsByYear[mechanicsByYear.length - 1];
        svg.append("text")
            .attr("x", x(lastPoint.year) + 5)
            .attr("y", y(lastPoint[mech]))
            .attr("fill", color(mech))
            .style("font-size", "12px")
            .text(mech);
    });
}

const tooltip = d3.select("body")
    .append("div")
    .style("position", "absolute")
    .style("background", "rgba(17, 17, 17, 0.9)")
    .style("padding", "1rem")
    .style("size", "0.5rem")
    .style("opacity", 1)
    .style("z-index", 2);

function updateChart(stepIndex) {
    // We can highlight specific lines based on the step
    const svg = d3.select("#vis-container svg");

    // Reset all
    svg.selectAll(".line-mech").attr("opacity", 0.2).attr("stroke-width", 1)
    svg.selectAll(".line-point").style("opacity", 0)

    switch (stepIndex) {
        case 0:
            svg.selectAll(".line-mech").attr("opacity", 1).attr("stroke-width", 2)
            break;
        case 1: // Dice Rolling
            svg.select("#line-DiceRolling").attr("opacity", 1).attr("stroke-width", 4);
            break;
        case 2: // Hand Management
            svg.select("#line-HandManagement").attr("opacity", 1).attr("stroke-width", 4);
            break;
        case 3: // Complexity Rising
            svg.select("#line-DeckBagandPoolBuilding").attr("opacity", 1).attr("stroke-width", 4);
            svg.select("#line-CooperativeGame").attr("opacity", 1).attr("stroke-width", 4);
            svg.select("#line-AreaMajorityInfluence").attr("opacity", 1).attr("stroke-width", 4);
            break;
        case 4: // Clickable interactive chart
            console.log("updateChart(3) called");
            
            svg.selectAll(".line-mech")
                .attr("opacity", 0.2)
                .attr("stroke-width", 2);

            svg.selectAll(".line-point")
                .style("opacity", 0.9)
                .style("pointer-events", "all")
                .on("mouseenter", function (event, d) {
                    console.log("mouse entered" + JSON.stringify(d))
                    d3.select(this)
                    .attr("r", 7);

                    const mechanic = this.id

                    tooltip
                    .style("opacity", 1)
                    .html(`
                        ${d[mechanic]} games
                    `);
                })
                .on("mousemove", function (event) {
                    tooltip
                    .style("left", event.pageX + 10 + "px")
                    .style("top", event.pageY + 10 + "px");
                })
                .on("mouseleave", function () {
                    d3.select(this).attr("r", 4);
                    tooltip.style("opacity", 0);
                });
            break;
    }
}

// --- Complexity Chart ---

function downsampleEveryN(data, maxPoints) {
  if (data.length <= maxPoints) return data;
  const step = Math.ceil(data.length / maxPoints);
  return data.filter((_, i) => i % step === 0);
}

function linearRegression(x, y) {
  const n = x.length;
  const xMean = d3.mean(x);
  const yMean = d3.mean(y);

  let num = 0;
  let den = 0;

  for (let i = 0; i < n; i++) {
    num += (x[i] - xMean) * (y[i] - yMean);
    den += (x[i] - xMean) * (x[i] - xMean);
  }

  const slope = num / den;
  const intercept = yMean - slope * xMean;

  return { slope, intercept };
}

function renderComplexityChart(data) {
    const container = d3.select("#vis-complexity");
    const width = container.node().getBoundingClientRect().width;
    const height = container.node().getBoundingClientRect().height;
    const margin = { top: 20, right: 20, bottom: 40, left: 40 };

    container.html("");

    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Scales
    const x = d3.scaleLinear()
        .domain([1, 5]) // Weight 1-5
        .range([0, width - margin.left - margin.right]);

    const y = d3.scaleLinear()
        .domain([0, 10]) // Rating 0-10
        .range([height - margin.top - margin.bottom, 0]);

    // Axes
    svg.append("g")
        .attr("transform", `translate(0, ${height - margin.top - margin.bottom})`)
        .call(d3.axisBottom(x).ticks(5));

    svg.append("g")
        .call(d3.axisLeft(y));

    const plotData = downsampleEveryN(data, 15000);

    svg.selectAll("circle")
        .data(plotData)
        .enter()
        .append("circle")
        .attr("cx", d => x(d.weight))
        .attr("cy", d => y(d.rating))
        .attr("r", 2)
        .attr("fill", "#457b9d")
        .attr("opacity", 0.3) // High transparency to show density
        .attr("class", "dot-complexity");
    
        // ---- TRENDLINE ----

        // Linear regression of rating ~ weight
        const lr = linearRegression(
            data.map(d => d.weight),
            data.map(d => d.rating)
        );

        // Endpoints of the trendline (x = 1 to 5)
        const xMin = 1;
        const xMax = 5;

        const yMin = lr.intercept + lr.slope * xMin;
        const yMax = lr.intercept + lr.slope * xMax;

        svg.append("line")
        .attr("class", "trendline-complexity")
        .attr("x1", x(xMin))
        .attr("y1", y(yMin))
        .attr("x2", x(xMax))
        .attr("y2", y(yMax))
        .attr("stroke", "white")
        .attr("stroke-width", 3)
        .attr("opacity", 0); // ✅ start hidden
}

function updateComplexityChart(stepIndex) {
    const svg = d3.select("#vis-complexity svg");

    // Reset
    svg.selectAll(".dot-complexity")
        .attr("fill", "#457b9d")
        .attr("r", 2)
        .attr("opacity", 0.3);
    
    svg.selectAll(".trendline-complexity")
        .attr("opacity", 0);

    switch (stepIndex) {
        case 0: // 90s Simple Games
            // Highlight games from < 2000
            break;
        case 1: // Heavier is Better
            svg.selectAll(".trendline-complexity")
                .attr("opacity", 0.7);
            break;
        case 2: // Sweet Spot
            // svg.selectAll(".dot-complexity")
            //     .filter(d => d.weight > 3.5 && d.weight < 4.5)
            //     .attr("fill", "#e9c46a")
            //     .attr("opacity", 0.5)
            //     .attr("r", 3);

            svg.selectAll(".dot-complexity")
                .filter(d => d.year > 2015)
                .attr("fill", "#e63946")
                .attr("opacity", 0.6)
                .attr("r", 3);
            break;
    }
}

// --- Interactive Builder Logic ---

function initBuilder(data) {
    const mechanicSelect = d3.select("#builder-mechanic");
    const weightInput = d3.select("#builder-weight");
    const timeInput = d3.select("#builder-time");

    // Update labels
    weightInput.on("input", function () {
        d3.select("#builder-weight-val").text(this.value);
        updatePrediction(data);
    });

    timeInput.on("input", function () {
        d3.select("#builder-time-val").text(this.value);
        updatePrediction(data);
    });

    mechanicSelect.on("change", function () {
        updatePrediction(data);
    });

    // Initial call
    updatePrediction(data);
}

function updatePrediction(data) {
    const mech = d3.select("#builder-mechanic").property("value");
    const weight = +d3.select("#builder-weight").property("value");
    const time = +d3.select("#builder-time").property("value");

    // Filter games
    // We look for games within a range of weight (+- 0.5) and time (+- 30 mins)
    // And containing the mechanic (if not 'all')

    const matches = data.filter(d => {
        const weightMatch = Math.abs(d.weight - weight) <= 0.5;
        const timeMatch = Math.abs(d.playtime - time) <= 30;
        const mechMatch = mech === "all" || d.mechanics.includes(mech);

        return weightMatch && timeMatch && mechMatch;
    });

    // Calculate stats
    const avgRating = matches.length > 0 ? d3.mean(matches, d => d.rating) : 0;

    // Update UI
    const scoreEl = d3.select("#prediction-score");
    if (matches.length < 5) {
        scoreEl.text("N/A");
        scoreEl.style("font-size", "2rem").text("Not enough data");
    } else {
        scoreEl.text(avgRating.toFixed(1));
        scoreEl.style("font-size", "4rem");
    }

    // Show top 3 similar games
    const topGames = matches.sort((a, b) => b.rating - a.rating).slice(0, 3);
    const list = d3.select("#similar-list");
    list.html("");

    topGames.forEach(g => {
        list.append("li")
            .html(`<strong>${g.name}</strong> <span>(${g.year})</span>`);
    });
}

// ============================================
// QUIZ FUNCTIONALITY
// Pudding-style interactive quiz
// ============================================

let quizData = [];
let quizAnswers = {
    playtime: null,
    weight: null,
    players: null,
    mechanic: null,
    year: null
};
let currentQuestion = 0;
const totalQuestions = 5;

function initQuiz(data) {
    quizData = data;

    // Start button
    d3.select("#start-quiz").on("click", startQuiz);

    // Retake button
    d3.select("#retake-quiz").on("click", resetQuiz);

    // Option buttons
    d3.selectAll(".option-btn").on("click", function () {
        handleOptionClick(this);
    });
}

function startQuiz() {
    d3.select("#quiz-intro").classed("active", false);
    d3.select("#quiz-questions").classed("active", true);
    currentQuestion = 0;
    updateProgress();
}

function resetQuiz() {
    // Reset answers
    quizAnswers = {
        playtime: null,
        weight: null,
        players: null,
        mechanic: null,
        year: null
    };
    currentQuestion = 0;

    // Reset UI
    d3.selectAll(".option-btn").classed("selected", false);
    d3.selectAll(".question").classed("active", false);
    d3.select(".question[data-question='0']").classed("active", true);

    // Show intro
    d3.select("#quiz-results").classed("active", false);
    d3.select("#quiz-intro").classed("active", true);
}

function handleOptionClick(btn) {
    const button = d3.select(btn);
    const questionEl = button.node().closest(".question");
    const questionIndex = +questionEl.dataset.question;
    const value = button.attr("data-value");

    // Remove selected from siblings
    d3.select(questionEl).selectAll(".option-btn").classed("selected", false);

    // Add selected to clicked
    button.classed("selected", true);

    // Store answer
    const answerKeys = ["playtime", "weight", "players", "mechanic", "year"];
    quizAnswers[answerKeys[questionIndex]] = isNaN(+value) ? value : +value;

    // Auto-advance after short delay
    setTimeout(() => {
        if (currentQuestion < totalQuestions - 1) {
            currentQuestion++;
            showQuestion(currentQuestion);
            updateProgress();
        } else {
            showResults();
        }
    }, 400);
}

function showQuestion(index) {
    d3.selectAll(".question").classed("active", false);
    d3.select(`.question[data-question='${index}']`).classed("active", true);
}

function updateProgress() {
    const progress = ((currentQuestion + 1) / totalQuestions) * 100;
    d3.select("#progress-fill").style("width", `${progress}%`);
    d3.select("#progress-text").text(`${currentQuestion + 1} / ${totalQuestions}`);
}

function showResults() {
    d3.select("#quiz-questions").classed("active", false);
    d3.select("#quiz-results").classed("active", true);

    // Calculate matches and render visualization
    renderResultsVisualization();
}

function renderResultsVisualization() {
    const container = d3.select("#results-viz");
    const containerNode = container.node();
    const width = containerNode.getBoundingClientRect().width;
    const height = containerNode.getBoundingClientRect().height || 500;
    const margin = { top: 40, right: 40, bottom: 60, left: 60 };

    container.html("");

    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height);

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Filter valid data points (need weight and rating)
    const validData = quizData.filter(d => d.weight && d.rating && d.weight > 0);

    // Scales
    const x = d3.scaleLinear()
        .domain([1, 5])
        .range([0, innerWidth]);

    const y = d3.scaleLinear()
        .domain([0, 10])
        .range([innerHeight, 0]);

    // Add gradient for background
    const defs = svg.append("defs");

    const gradient = defs.append("radialGradient")
        .attr("id", "result-glow")
        .attr("cx", "50%")
        .attr("cy", "50%")
        .attr("r", "50%");

    gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#ff4d4d")
        .attr("stop-opacity", 0.3);

    gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#ff4d4d")
        .attr("stop-opacity", 0);

    // Draw axes
    const xAxis = g.append("g")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(x).ticks(5).tickFormat(d => d.toFixed(1)))
        .attr("class", "axis");

    xAxis.selectAll("text").attr("fill", "#a0a0a0");
    xAxis.selectAll("line").attr("stroke", "#333");
    xAxis.select(".domain").attr("stroke", "#333");

    const yAxis = g.append("g")
        .call(d3.axisLeft(y).ticks(5))
        .attr("class", "axis");

    yAxis.selectAll("text").attr("fill", "#a0a0a0");
    yAxis.selectAll("line").attr("stroke", "#333");
    yAxis.select(".domain").attr("stroke", "#333");

    // Axis labels
    g.append("text")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight + 45)
        .attr("text-anchor", "middle")
        .attr("class", "axis-label")
        .text("Complexity (Weight)");

    g.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -innerHeight / 2)
        .attr("y", -45)
        .attr("text-anchor", "middle")
        .attr("class", "axis-label")
        .text("Average Rating");

    // Sample data for performance (take ~2000 random points)
    const sampledData = validData.length > 2000
        ? d3.shuffle(validData.slice()).slice(0, 2000)
        : validData;

    // Draw all games as background dots
    g.selectAll(".bg-dot")
        .data(sampledData)
        .enter()
        .append("circle")
        .attr("class", "bg-dot")
        .attr("cx", d => x(d.weight))
        .attr("cy", d => y(d.rating))
        .attr("r", 2)
        .attr("fill", "#4da6ff")
        .attr("opacity", 0.08);

    // Find matching games based on user preferences
    const userWeight = quizAnswers.weight || 2.5;
    const userPlaytime = quizAnswers.playtime || 60;
    const userMechanic = quizAnswers.mechanic;
    const userYear = quizAnswers.year || 2015;

    // Score and sort games by similarity
    const scoredGames = validData.map(game => {
        let score = 0;

        // Weight similarity (most important)
        const weightDiff = Math.abs(game.weight - userWeight);
        score += (1 - weightDiff / 4) * 40;

        // Playtime similarity
        const timeDiff = Math.abs((game.playtime || 60) - userPlaytime);
        score += (1 - Math.min(timeDiff / 180, 1)) * 20;

        // Mechanic match
        if (userMechanic && game.mechanics && game.mechanics.includes(userMechanic)) {
            score += 25;
        }

        // Year preference
        const yearDiff = Math.abs((game.year || 2015) - userYear);
        score += (1 - Math.min(yearDiff / 30, 1)) * 15;

        return { ...game, matchScore: score };
    });

    scoredGames.sort((a, b) => b.matchScore - a.matchScore);

    // Top matches
    const topMatches = scoredGames.slice(0, 100);
    const bestMatches = scoredGames.slice(0, 5);

    // Highlight matching games
    g.selectAll(".match-dot")
        .data(topMatches)
        .enter()
        .append("circle")
        .attr("class", "match-dot")
        .attr("cx", d => x(d.weight))
        .attr("cy", d => y(d.rating))
        .attr("r", 0)
        .attr("fill", "#ffd700")
        .attr("opacity", 0.4)
        .transition()
        .delay((d, i) => i * 10)
        .duration(500)
        .attr("r", 4);

    // Calculate user's position (average of best matches)
    const userX = userWeight;
    const userY = bestMatches.length > 0 ? d3.mean(bestMatches, d => d.rating) : 7;

    // Add glow effect behind user marker
    g.append("circle")
        .attr("cx", x(userX))
        .attr("cy", y(userY))
        .attr("r", 30)
        .attr("fill", "url(#result-glow)")
        .attr("class", "user-glow");

    // Pulse animation
    g.append("circle")
        .attr("cx", x(userX))
        .attr("cy", y(userY))
        .attr("r", 8)
        .attr("class", "user-marker-pulse");

    // User marker
    g.append("circle")
        .attr("cx", x(userX))
        .attr("cy", y(userY))
        .attr("r", 0)
        .attr("class", "user-marker")
        .transition()
        .delay(500)
        .duration(600)
        .ease(d3.easeElastic)
        .attr("r", 10);

    // Add "YOU" label
    g.append("text")
        .attr("x", x(userX))
        .attr("y", y(userY) - 20)
        .attr("text-anchor", "middle")
        .attr("fill", "#fff")
        .attr("font-weight", "600")
        .attr("font-size", "14px")
        .attr("opacity", 0)
        .text("YOU")
        .transition()
        .delay(800)
        .duration(400)
        .attr("opacity", 1);

    // Calculate percentiles
    const weightPercentile = calculatePercentile(validData.map(d => d.weight), userWeight);
    const matchPercentile = calculatePercentile(scoredGames.map(d => d.matchScore), bestMatches[0]?.matchScore || 0);

    // Update stats
    const statsContainer = d3.select("#results-stats");
    statsContainer.html("");

    const stats = [
        { value: bestMatches.length > 0 ? bestMatches[0].rating.toFixed(1) : "N/A", label: "Predicted Rating" },
        { value: `${Math.round(weightPercentile)}%`, label: "Complexity Percentile" },
        { value: topMatches.length, label: "Similar Games" }
    ];

    stats.forEach(stat => {
        const card = statsContainer.append("div").attr("class", "stat-card");
        card.append("div").attr("class", "stat-value").text(stat.value);
        card.append("div").attr("class", "stat-label").text(stat.label);
    });

    // Update matches list
    const matchesList = d3.select("#results-matches-list");
    matchesList.html("");

    bestMatches.forEach(game => {
        const li = matchesList.append("li");
        li.append("span")
            .attr("class", "match-name")
            .text(game.name);

        const info = li.append("span").attr("class", "match-info");
        info.append("span").text(game.year || "—");
        info.append("span")
            .attr("class", "match-rating")
            .text(`★ ${game.rating.toFixed(1)}`);
    });
}

function calculatePercentile(arr, value) {
    const sorted = arr.slice().sort((a, b) => a - b);
    const index = sorted.findIndex(v => v >= value);
    if (index === -1) return 100;
    return (index / sorted.length) * 100;
}

init();