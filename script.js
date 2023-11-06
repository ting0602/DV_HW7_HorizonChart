d3.csv("http://vis.lab.djosix.com:2023/data/air-pollution.csv").then(function(data) {

    // Define 
    var svgWidth = 4000, svgHeight = 4000;
    const margin = {top: 50, right: 200, bottom: 50, left: 200};
    const padding = 50;
    const band_padding = 1;
    var width = svgWidth - margin.left - margin.right;
    var height = svgHeight - margin.top - margin.bottom;
    var bands = 5

    const parseDate = d3.timeParse("%Y-%m-%d");
    const formatDate = d3.timeFormat("%Y-%m-%d");
    
    const bandsSlider = document.getElementById("bands");
    const bandsValue = document.getElementById("bands-value");
    bandsValue.textContent = bands;

    // Initialize the selector value
    var sortOrder = "ascending";
    var targetYear = "2019"

    // Initialize the svg
    const svg = d3.select("body").append("svg")
        .attr("width", svgWidth)
        .attr("height", svgHeight)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Initialize data
    const pollutants = ["SO2", "NO2", "O3", "CO", "PM10", "PM2.5"];
    const addressesSet = new Set();
    var dataByPollutant = {};

    pollutants.forEach(pollutant => {
        // Determine the number of decimal places for the current pollutant
        const decimalPlaces = fixed_number(pollutant);
        dataByPollutant[pollutant] = {};

        data.forEach(d => {
             // Split the address into parts and extract the area name
            const addressParts = d["Address"].split(", ");
            const areaName = addressParts[addressParts.length - 3];

            // Split the measurement date and extract the year, month, and day
            const dateParts = d["Measurement date"].split(" ");
            const yearMonthDay = dateParts[0];
            const year = dateParts[0].split("-")[0];

            addressesSet.add(areaName);

            if (!dataByPollutant[pollutant][year]) {
                dataByPollutant[pollutant][year] = {};
            }

            if (!dataByPollutant[pollutant][year][areaName]) {
                dataByPollutant[pollutant][year][areaName] = [];
            }

            // Check: data for the same date and area name already exists
            if (!dataByPollutant[pollutant][year][areaName].find(item => item.Date === yearMonthDay)) {
                dataByPollutant[pollutant][year][areaName].push({
                    "Date": yearMonthDay,
                    "Address": areaName,
                    "Pollutant": (+d[pollutant]).toFixed(decimalPlaces),
                });
            }
        });
    });

    const addresses = Array.from(addressesSet);
    let selectedTypes = pollutants;

    // Init: color map
    var colors = d3.scaleOrdinal()
        .domain(pollutants)
        .range(d3.schemeCategory10);
    
    // Listen to the change event on the sort-order selector dropdown
    d3.select("#sort-order-selector").on("change", function() {
        // Get the selected sort order value
        sortOrder = this.value;
        updateChart();
    });

    // Listen to the change event on the year selector dropdown
    d3.select("#year-selector").on("change", function() {
        targetYear = this.value;
        updateChart();
    });

    // Select all checkboxes on the page
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');

    // Listen to the change event on checkboxes
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
        // check: add the type to selectedTypes
        if (this.checked) {
            selectedTypes.push(this.value);
        } else {
            // uncheck: remove the type from selectedTypes
            const index = selectedTypes.indexOf(this.value);
            if (index !== -1) {
            selectedTypes.splice(index, 1);
            }
        }
        // Update the chart
        updateChart();
        });
    });
    
    // Initialize the selectedTypes array
    selectedTypes = Array.from(checkboxes)
        .filter(checkbox => checkbox.checked)
        .map(checkbox => checkbox.value);

    // Update bands
    bandsSlider.addEventListener("input", function() {
        bands = +bandsSlider.value;
        bandsValue.textContent = bandsSlider.value;
        updateChart()
    });
    updateChart()


    // Color scaler
    function get_color(pollutant, index) {
        const current_color = colors(pollutant);
        // const interpolateRange = [d3.color(current_color).brighter(3), d3.color(current_color)];
        const interpolateRange = [d3.color(current_color).brighter(2), d3.color(current_color).darker(2)]
        const colorInterpolator = d3.scaleLinear()
            .domain([0, 4])
            // .domain([0, bands - 1])
            .range(interpolateRange);
    
        return colorInterpolator(index);
    }
    
    // Main function
    // Update the Horizon Chart
    function updateChart() {
        // Remove all elements from the SVG
        svg.selectAll("*").remove();

        // Calculate the width and height of each chart
        const imgWidth = ((width-50) / selectedTypes.length) - 2 * padding; // width of each chart
        const imgHeight = ((height-10) / addresses.length) - 2 * padding;// height of each chart

        // Loop through addresses
        addresses.forEach((address, rowIndex) => {
            // Create a group for the current address
            const addressGroup = svg.append("g")
                .attr("transform", `translate(50, ${rowIndex * (imgHeight + padding) + 10})`)
                .attr("style", "font: 12px sans-serif;");
            
            // Loop through selected pollutants
            selectedTypes.forEach((pollutant, colIndex) => {
                // Get target data
                const addressData = dataByPollutant[pollutant][targetYear][address];

                var series = d3.rollup(addressData, values => values, d => d.Address);

                // Create a group for the current chart
                const g = addressGroup.append("g")
                    .selectAll("g")
                    .data(series)
                    .join("g")
                    .attr("transform", `translate(${colIndex * (imgWidth + padding)}, 0)`)
                    .attr("width", imgWidth)
                    .attr("height", imgHeight)

                // Sorting
                var xScale
                if (sortOrder === "ascending") {
                    xScale = d3.scaleTime()
                        .domain(d3.extent(addressData, d => parseDate(d.Date)))
                        .range([0, imgWidth]);
                } else {
                    xScale = d3.scaleTime()
                        .domain(d3.extent(addressData, d => parseDate(d.Date)))
                        .range([imgWidth, 0]);
                }

                const yScale = d3.scaleLinear()
                    // Hint: d.Pollutant may be negative
                    .domain([Math.max(d3.min(addressData, d => d.Pollutant), 0), d3.max(addressData, d => d.Pollutant)])
                    .range([imgHeight, imgHeight - bands * (imgHeight - band_padding)]);

                // Add X-Axis
                const xAxis = d3.axisBottom(xScale)
                    .tickSize(3)
                    .ticks(12 * (7 - selectedTypes.length))
                    .tickFormat(d3.timeFormat("%m/%d"));

                // Create the X-Axis
                g.append("g")
                    .attr("class", "x-axis")
                    .attr("transform", `translate(0, ${imgHeight})`)
                    .call(xAxis)
                    .selectAll("text")
                    .style("text-anchor", "end")
                    .attr("transform", "rotate(-45)");
                
                // Create a unique ID for the clip path
                const uid = `O-${Math.random().toString(16).slice(2)}`;

                // Add a rectangular clipPath and the reference area.
                const area = d3.area()
                    .defined(d => !isNaN(d.Pollutant))
                    .x(d => xScale(parseDate(d.Date)))
                    .y0(imgHeight)
                    .y1(d => yScale(d.Pollutant));

                const defs = g.append("defs");

                // Create a clip path for the area
                defs.append("clipPath")
                    .attr("id", (_, i) => `${uid}-clip-${i}`)
                    .append("rect")
                    .attr("y", band_padding)
                    .attr("width", imgWidth)
                    .attr("height", imgHeight - band_padding);

                // Create a path for the area
                defs.append("path")
                    .attr("id", (_, i) => `${uid}-path-${i}`)
                    .attr("d", ([, values]) => area(values));

                // Create areas for each band using clip path
                g.append("g")
                    .attr("clip-path", (_, i) => `url(${new URL(`#${uid}-clip-${i}`, location)})`)
                    .selectAll("use")
                    .data((_ ,i) => new Array(bands).fill(i))
                    .enter().append("use")
                        .attr("xlink:href", (i) => `${new URL(`#${uid}-path-${i}`, location)}`)
                        .attr("fill", (_, i) => get_color(pollutant, i))
                        .attr("transform", (_, i) => `translate(0,${i * imgHeight})`);

                // Create a vertical line for mouseover
                const verticalLine = g.append("line")
                    .attr("class", "vertical-line")
                    .attr("x1", 0)
                    .attr("x2", 0)
                    .attr("y1", 0)
                    .attr("y2", imgHeight)
                    .style("stroke", "black")
                    .style("stroke-width", 1.5)
                    .style("display", "none");

                // Create a rect for binding mouseover function
                g.append("rect")
                    .attr("class", "horizon-overlay")
                    .attr("x", 0)
                    .attr("y", 0)
                    .attr("width", imgWidth)
                    .attr("height", imgHeight)
                    .attr("fill", "transparent")

                g.select(".horizon-overlay")
                    .on("mouseover", function(event, d) {
                        const rect = event.currentTarget.getBoundingClientRect();
                        const xValue = xScale.invert(event.clientX - rect.left);
                        // Update vertical line's position
                        verticalLine
                            .attr("x1", xScale(xValue))
                            .attr("x2", xScale(xValue))
                            .style("display", "block");
                        mouseover(event, d, xValue, pollutant)
                    })
                    .on("mouseleave", function() {
                        verticalLine.style("display", "none");
                        mouseleave()

                    });

                if (colIndex == 0) {
                    // Add the address labels
                    addressGroup.append("text")
                        .attr("x", -120)
                        .attr("y", (imgHeight) / 2)
                        .attr("dy", "0.35em")
                        .style("font-weight", "bold")
                        .text(address); 
                }

                if (rowIndex == 0) {
                    // Add the pollutant labels
                    addressGroup.append("text")
                        .attr("x", colIndex * (imgWidth + padding) + 0.5 * imgWidth)
                        .attr("y", -margin.top)
                        .style("font-weight", "bold")
                        .text(pollutant); 
                }
            });
          });


        // Function to handle mouseover event on x-axis
        function mouseover(event, d, xValue, pollutant) {
            // Get the mouse position
            const [x, y] = d3.pointer(event);
            const target = d[1].filter(d => d.Date === formatDate(xValue))[0]
            
            // Display the tooltip
            d3.select("#tooltip")
                .style("display", "block")
                .html(`Date: ${target.Date}<br>Address: ${target.Address}<br>${pollutant}: ${target.Pollutant}`);
        }
        // Function to handle mouseleave event
        function mouseleave() {
            d3.select("#tooltip")
                .style("display", "none")
                .html('');
        }
    }
        
})

function fixed_number(pollutant) {
    switch (pollutant) {
        case "SO2":
        case "NO2":
        case "O3":
            return 3;
        case "CO":
        case "PM10":
        case "PM2.5":
            return 1;
        default:
            return 2;
    }
}