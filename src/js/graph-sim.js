const Mode = {
    ADD_VERTEX: 'add_vertex',
    ADD_EDGE: 'add_edge',
    ADD_EDGE_REDIRECT: 'add_edge_redirect',
    REMOVE_ELEMENT: 'remove_edge',
    MOVE_VERTEX: 'move_vertex'
};

function initializeGraphSim(canvasId) {

    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // on size change
    window.addEventListener('resize', () => {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        drawGraph();
    });

    const vertexRadius = 15;
    const edgeWidth = 2;

    let vertices = [];
    let nonExistentVertices = [];
    let edges = [];

    let edgesSplitUp = [];
    let polygons = [];

    let updateListeners = [];
    let modeChangedListeners = [];

    function addUpdateListener(listener) {
        updateListeners.push(listener);
    }

    function addModeChangedListener(listener) {
        modeChangedListeners.push(listener);
    }

    let visualizationOptions = {
        showEdges: true,
        showVertices: true,
        showPolygons: true,
        showIntersections: true,
        showPolygonIndices: false,
    }

// Modes
    let currentMode = Mode.ADD_VERTEX;
    let isMouseDown = false;

    function drawVertex(x, y, color) {
        ctx.beginPath();
        ctx.arc(x, y, vertexRadius + 2, 0, Math.PI * 2);
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.closePath();

        ctx.beginPath();
        ctx.arc(x, y, vertexRadius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.closePath();
    }

// Function to draw an edge between two vertices
    function drawEdge(startVertex, endVertex, colorMode = true) {
        ctx.beginPath();
        ctx.strokeStyle = colorMode ? '#000' : '#000';
        ctx.lineWidth = edgeWidth;
        ctx.moveTo(startVertex.x, startVertex.y);
        ctx.lineTo(endVertex.x, endVertex.y);
        ctx.stroke();
        ctx.closePath();
    }

// Function to draw the graph
    function drawGraph() {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!isMouseDown) {
            edgesSplitUp = splitEdges();
            polygons = applyPolygonColor(findPolygons(edgesSplitUp.newEdges));
            if (visualizationOptions.showPolygons) {
                for (const polygon of polygons) {
                    const area = polygon.points;
                    const color = polygon.color;

                    ctx.beginPath();
                    ctx.moveTo(area[0].x, area[0].y);
                    for (let i = 1; i < area.length; i++) {
                        ctx.lineTo(area[i].x, area[i].y);
                    }
                    ctx.closePath();
                    ctx.fillStyle = color;
                    ctx.fill();
                }
            }

            if (visualizationOptions.showPolygonIndices) {
                let index = 0;
                for (const polygon of polygons) {
                    const area = polygon.points;

                    const center = findPolygonCenter(area);
                    ctx.beginPath();
                    ctx.font = "18px Arial";
                    ctx.fillStyle = '#000';
                    ctx.fillText((index + 1) + '', center.x, center.y);
                    ctx.fill();
                    ctx.closePath();

                    index++;
                }
            }
        }

        if (visualizationOptions.showEdges) {
            ctx.strokeStyle = '#000';
            for (const edge of edges) {
                drawEdge(edge.startVertex, edge.endVertex, edge.countTowardsTotal !== false);
            }
        }

        if (visualizationOptions.showIntersections) {
            for (let i = 0; i < edgesSplitUp.intersections.length; i++) {
                const intersection = edgesSplitUp.intersections[i];
                ctx.beginPath();
                ctx.arc(intersection.x, intersection.y, 5, 0, Math.PI * 2);
                ctx.fillStyle = '#000';
                ctx.fill();
                ctx.closePath();
            }
        }

        if (visualizationOptions.showVertices) {
            for (const vertex of vertices) {
                drawVertex(vertex.x, vertex.y, vertex.color);
            }
        }

        // if (!isMouseDown) {
        //     drawDebugItems();
        // }

        for (const listener of updateListeners) {
            listener(getState());
        }
    }

    let selectedVertex = null;
    let draggedVertex = null;
    let draggedStart = null; // {x: number, y: number}

// Function to handle mouse down event
    function handleMouseDown(event) {
        if (!isMouseDown) {
            isMouseDown = true;
        }

        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        if (currentMode === Mode.ADD_VERTEX) {
            // If in add vertex mode, create a new vertex
            vertices.push({
                x: mouseX,
                y: mouseY,
                color: getRandomColor()
            });
        } else if (currentMode === Mode.ADD_EDGE || currentMode === Mode.ADD_EDGE_REDIRECT) {
            if (selectedVertex) {
                return;
            }
            // If in add edge mode, find the vertex under the mouse
            for (const vertex of vertices) {
                const distance = Math.sqrt((mouseX - vertex.x) ** 2 + (mouseY - vertex.y) ** 2);
                if (distance <= vertexRadius) {
                    // If a vertex is clicked, select it as the start vertex for the new edge
                    selectedVertex = vertex;
                    return;
                }
            }
        } else if (currentMode === Mode.REMOVE_ELEMENT) {
            for (const edge of edges) {
                const distance = distanceToLine(mouseX, mouseY, edge.startVertex, edge.endVertex);
                if (distance <= 10) { // threshold for easier selection
                    edges = edges.filter(e => e !== edge);
                    return;
                }
            }
            for (const vertex of vertices) {
                const distance = Math.sqrt((mouseX - vertex.x) ** 2 + (mouseY - vertex.y) ** 2);
                if (distance <= vertexRadius) {
                    vertices = vertices.filter(v => v !== vertex);
                    // Also remove any edges connected to the vertex
                    edges = edges.filter(e => e.startVertex !== vertex && e.endVertex !== vertex);
                    return;
                }
            }
        } else if (currentMode === Mode.MOVE_VERTEX) {
            for (const vertex of vertices) {
                const distance = Math.sqrt((mouseX - vertex.x) ** 2 + (mouseY - vertex.y) ** 2);
                if (distance <= vertexRadius) {
                    draggedVertex = vertex;
                    draggedStart = { x: mouseX, y: mouseY };
                    break;
                }
            }
            if (!draggedVertex) {
                for (const vertex of nonExistentVertices) {
                    const distance = Math.sqrt((mouseX - vertex.x) ** 2 + (mouseY - vertex.y) ** 2);
                    if (distance <= vertexRadius) {
                        draggedVertex = vertex;
                        draggedStart = { x: mouseX, y: mouseY };
                        break;
                    }
                }
            }
        }

        // Redraw the graph
        drawGraph();
    }

// Function to handle mouse move event
    function handleMouseMove(event) {
        if ((currentMode === Mode.ADD_EDGE || currentMode === Mode.ADD_EDGE_REDIRECT) && selectedVertex) {
            // If in add edge mode and a vertex is selected, draw a temporary edge
            const rect = canvas.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            drawGraph();
            drawEdge(selectedVertex, { x: mouseX, y: mouseY });
        } else if (currentMode === Mode.MOVE_VERTEX && draggedVertex) {
            const rect = canvas.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            draggedVertex.x += mouseX - draggedStart.x;
            draggedVertex.y += mouseY - draggedStart.y;
            draggedStart = { x: mouseX, y: mouseY };
            drawGraph();
        }
    }

// Function to handle mouse up event
    function handleMouseUp(event) {
        if (isMouseDown) {
            isMouseDown = false;
        }

        if ((currentMode === Mode.ADD_EDGE || currentMode === Mode.ADD_EDGE_REDIRECT) && selectedVertex) {
            // If in add edge mode and a vertex is selected, find the end vertex under the mouse
            const rect = canvas.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            let foundVertex = false;
            for (const vertex of vertices) {
                const distance = Math.sqrt((mouseX - vertex.x) ** 2 + (mouseY - vertex.y) ** 2);
                if (distance <= vertexRadius) {
                    // If a vertex is clicked, add the edge to the array
                    edges.push({ startVertex: selectedVertex, endVertex: vertex });
                    selectedVertex = null;
                    foundVertex = true;
                    break;
                }
            }
            if (!foundVertex) {
                // the user wants to break up the line, add a new vertex at the mouse position and still resume the edge
                const newVertex = {
                    x: mouseX,
                    y: mouseY,
                    color: getRandomColor()
                };
                if (currentMode === Mode.ADD_EDGE_REDIRECT) {
                    nonExistentVertices.push(newVertex);
                    edges.push({ startVertex: selectedVertex, endVertex: newVertex, countTowardsTotal: false });
                } else if (currentMode === Mode.ADD_EDGE) {
                    vertices.push(newVertex);
                    edges.push({ startVertex: selectedVertex, endVertex: newVertex });
                }
                selectedVertex = newVertex;
            }
        } else if (currentMode === Mode.MOVE_VERTEX && draggedVertex) {
            draggedVertex = null;
        }

        drawGraph();
    }

// Function to calculate the distance from a point to a line
    function distanceToLine(x, y, startVertex, endVertex) {
        const numerator = Math.abs((endVertex.y - startVertex.y) * x - (endVertex.x - startVertex.x) * y + endVertex.x * startVertex.y - endVertex.y * startVertex.x);
        const denominator = Math.sqrt((endVertex.y - startVertex.y) ** 2 + (endVertex.x - startVertex.x) ** 2);
        return numerator / denominator;
    }

// Function to generate a random color
    function getRandomColor() {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }

// Function to change the current mode
    function changeMode(newMode) {
        currentMode = newMode;
        if (currentMode === Mode.ADD_EDGE) {
            selectedVertex = null; // Reset selected vertex when switching to add edge mode
        }
        for (const listener of modeChangedListeners) {
            listener(currentMode);
        }
    }

// Event listener to change mode
    document.addEventListener('keydown', event => {
        if (event.key === '1') {
            changeMode(Mode.ADD_VERTEX);
        } else if (event.key === '2') {
            changeMode(Mode.ADD_EDGE);
        } else if (event.key === '3') {
            changeMode(Mode.REMOVE_ELEMENT);
        } else if (event.key === '4') {
            changeMode(Mode.MOVE_VERTEX);
        } else if (event.key === '5') {
            changeMode(Mode.ADD_EDGE_REDIRECT);
        }
    });

// Event listeners
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);

// Initial draw
    drawGraph();


// Function to split edges where they intersect
    function splitEdges() {
        let newEdges = [];
        let allIntersections = new Set();

        for (const edge of edges) {
            const { startVertex: p1, endVertex: p2 } = edge;
            let intersections = [];
            for (const otherEdge of edges) {
                if (edge !== otherEdge) {
                    const { startVertex: p3, endVertex: p4 } = otherEdge;
                    const intersection = lineIntersection(p1, p2, p3, p4);
                    if (intersection && !isVertex(intersection)) {
                        // Add the intersection point if it's not already present
                        const existingIntersection = intersections.find(point => point.x === intersection.x && point.y === intersection.y);
                        if (!existingIntersection) {
                            intersections.push(intersection);
                        }
                    }
                }
            }
            // Sort the intersection points based on their distance from the starting vertex
            intersections.sort((a, b) => distance(p1, a) - distance(p1, b));
            // Split the edge into segments using the intersection points
            let prevVertex = p1;
            for (const intersection of intersections) {
                newEdges.push({ startVertex: prevVertex, endVertex: intersection });
                prevVertex = intersection;
            }
            allIntersections = new Set([...allIntersections, ...intersections]);
            newEdges.push({ startVertex: prevVertex, endVertex: p2 });
        }

        return {
            newEdges: newEdges,
            intersections: Array.from(allIntersections)
        };
    }

    function isVertex(point) {
        return vertices.some(vertex => vertex.x === point.x && vertex.y === point.y);
    }

// Function to calculate the intersection point of two lines
    function lineIntersection(p1, p2, p3, p4) {
        const x1 = p1.x, y1 = p1.y;
        const x2 = p2.x, y2 = p2.y;
        const x3 = p3.x, y3 = p3.y;
        const x4 = p4.x, y4 = p4.y;

        const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (denominator === 0) {
            // Lines are parallel or coincident
            return null;
        }

        const px = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / denominator;
        const py = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / denominator;

        if (px < Math.min(x1, x2) || px > Math.max(x1, x2) || px < Math.min(x3, x4) || px > Math.max(x3, x4) ||
            py < Math.min(y1, y2) || py > Math.max(y1, y2) || py < Math.min(y3, y4) || py > Math.max(y3, y4)) {
            // Intersection point is outside the segments
            return null;
        }

        return { x: px, y: py };
    }

// Function to calculate the distance between two points
    function distance(p1, p2) {
        return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
    }


    function findPolygons(edges) {
        // https://www.inesc-id.pt/ficheiros/publicacoes/936.pdf
        // THIS TOOK ME 8 HOURS OH MY GOD
        // it has one flaw, when the polygon is a container of other polygons that don't fill it completely,
        // the outer containing polygon will incorrectly create the bounding box too large, but that's fine for now,
        // since I mainly only need the amount of polygons and since they are drawn in order of size, the container
        // polygons will be drawn first and the contained polygons will be drawn on top of them.
        const graph = buildGraphFromEdges(edges);
        const cycles = findCycles(graph);
        const polygons = convertCyclesToPolygons(cycles);
        return filterPolygons(polygons).sort((a, b) => polygonArea(b) - polygonArea(a));
    }

    function buildGraphFromEdges(edges) {
        const graph = {};

        for (const edge of edges) {
            const startKey = `${edge.startVertex.x},${edge.startVertex.y}`;
            const endKey = `${edge.endVertex.x},${edge.endVertex.y}`;

            if (!graph[startKey]) {
                graph[startKey] = [];
            }
            if (!graph[endKey]) {
                graph[endKey] = [];
            }

            graph[startKey].push(endKey);
            graph[endKey].push(startKey);
        }

        return graph;
    }

    function findCycles(graph) {
        const cycles = [];
        const visited = new Set();

        function dfs(vertex, path) {
            visited.add(vertex);
            path.push(vertex);

            for (const neighbor of graph[vertex]) {
                if (!visited.has(neighbor)) {
                    dfs(neighbor, path);
                } else if (path.length > 2 && neighbor === path[0]) {
                    cycles.push([...path]);
                }
            }

            path.pop();
            visited.delete(vertex);
        }

        for (const vertex in graph) {
            if (!visited.has(vertex)) {
                dfs(vertex, []);
            }
        }

        return cycles;
    }

    function convertCyclesToPolygons(cycles) {
        const polygons = [];

        for (const cycle of cycles) {
            const polygon = [];
            for (const vertex of cycle) {
                const [x, y] = vertex.split(',').map(Number);
                polygon.push({ x, y });
            }
            polygons.push(polygon);
        }

        return polygons;
    }

////

    function filterPolygons(polygons) {
        const duplicates = removeDuplicatePolygons(polygons);
        const containerPoints = removeContainerPointPolygons(duplicates);
        return removeContainerPolygons(containerPoints);
    }

    function removeContainerPolygons(polygons) {
        const filteredPolygons = [];
        let lenience = -0.1;

        // Iterate through each polygon
        for (let i = 0; i < polygons.length; i++) {
            const polygon = polygons[i];
            const polygonAreaValue = polygonArea(polygon);
            let otherPolygonsAreaSum = 0;

            // Check if the current polygon contains any point from other polygons
            for (let j = 0; j < polygons.length; j++) {
                if (i !== j) {
                    const otherPolygon = polygons[j];

                    // Check if any point from the other polygon is inside the current polygon
                    for (const point of otherPolygon) {
                        if (isPointInsidePolygon(point, polygon) && !isPointInPolygonPoints(point, polygon)) {
                            otherPolygonsAreaSum += polygonArea(otherPolygon);
                            break;
                        }
                    }

                    if (otherPolygonsAreaSum > polygonAreaValue + lenience) {
                        break;
                    }
                }
            }

            // If the current polygon is not a container polygon, add it to the filtered polygons
            if (otherPolygonsAreaSum <= polygonAreaValue + lenience) {
                filteredPolygons.push(polygon);
            } else {
                // console.log("Container polygon found", polygon, otherPolygonsAreaSum, '>', polygonAreaValue + lenience);
            }
        }

        return filteredPolygons;
    }

    function isPointInsidePolygon(point, polygon) {
        // ray-casting algorithm based on
        // https://wrf.ecse.rpi.edu/Research/Short_Notes/pnpoly.html

        let isInside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;
            const intersect = ((yi > point.y) !== (yj > point.y)) &&
                (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
            if (intersect) isInside = !isInside;
        }
        return isInside;
    }

    function polygonArea(polygon) {
        let area = 0;
        for (let i = 0; i < polygon.length; i++) {
            const p1 = polygon[i];
            const p2 = polygon[(i + 1) % polygon.length];
            area += (p1.x * p2.y) - (p2.x * p1.y);
        }
        return Math.abs(area / 2);
    }

///


    function removeDuplicatePolygons(polygons) {
        const uniquePolygons = [];
        const polygonSet = new Set();

        for (const polygon of polygons) {
            const sortedPolygon = polygon.slice().sort((a, b) => {
                if (a.x === b.x) {
                    return a.y - b.y;
                }
                return a.x - b.x;
            });
            const polygonKey = sortedPolygon.map(point => `${point.x},${point.y}`).join('-');

            if (!polygonSet.has(polygonKey)) {
                uniquePolygons.push(polygon);
                polygonSet.add(polygonKey);
            }
        }

        return uniquePolygons;
    }

    function removeContainerPointPolygons(polygons) {
        const filteredPolygons = [];

        for (let i = 0; i < polygons.length; i++) {
            let isContained = false;

            for (let j = 0; j < polygons.length; j++) {
                if (i !== j && isPolygonPointContained(polygons[j], polygons[i])) {
                    isContained = true;
                    break;
                }
            }

            if (!isContained) {
                filteredPolygons.push(polygons[i]);
            }
        }

        return filteredPolygons;
    }

    function isPolygonPointContained(polygon1, polygon2) {
        for (const point of polygon1) {
            if (!isPointInPolygonPoints(point, polygon2)) {
                return false;
            }
        }
        return true;
    }

    function isPointInPolygonPoints(point, polygon) {
        // check for whether the point appears in the list of polygon points
        return polygon.some(p => p.x === point.x && p.y === point.y);
    }

    function findPolygonCenter(polygon) {
        let x = 0;
        let y = 0;
        for (const point of polygon) {
            x += point.x;
            y += point.y;
        }
        return { x: x / polygon.length, y: y / polygon.length };
    }

    function applyPolygonColor(polygons) {
        const colors = [
            '#ff8d8d', '#ffcfa1', '#ffff9f', '#cbff98',
            '#96fb96', '#8cffc7', '#95ffff', '#82c0ff',
            '#9e9eff', '#b87bff', '#ffbbff', '#ff7bc3',
            '#ff2e2e', '#ff9732', '#ffff08', '#87ff0e',
            '#2dff2d', '#25ff8f', '#13fdfd', '#1d8dff',
            '#1c1cff', '#9f43fa', '#ff36ff', '#ff1f8e',
            '#d5d5d5', '#9e9e9e', '#656565', '#49899e',
            '#3a8351', '#3c8080', '#5472b5', '#664b97',
            '#934793', '#a34a85', '#a34242'
        ];
        for (let i = 0; i < polygons.length; i++) {
            polygons[i] = { points: polygons[i], color: colors[i % colors.length] };
        }
        return polygons;
    }

    function drawDebugItems() {
        const edgesSplitUp = splitEdges();
        const intersections = edgesSplitUp.intersections;
        const edges = edgesSplitUp.newEdges;

        // draw each line in a different color with a thickness of 2
        for (let i = 0; i < edges.length; i++) {
            const edge = edges[i];
            ctx.beginPath();
            ctx.moveTo(edge.startVertex.x, edge.startVertex.y);
            ctx.lineTo(edge.endVertex.x, edge.endVertex.y);
            ctx.strokeStyle = getRandomColor();
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.closePath();

            // write as text the coordinates of the start and end of the line rounded to 2 decimal places
            ctx.fillStyle = '#000';
            ctx.font = "12px Arial";
            ctx.fillText(`(${edge.startVertex.x.toFixed(2)}, ${edge.startVertex.y.toFixed(2)})`, edge.startVertex.x + 20, edge.startVertex.y - 20);
            ctx.fillText(`(${edge.endVertex.x.toFixed(2)}, ${edge.endVertex.y.toFixed(2)})`, edge.endVertex.x + 20, edge.endVertex.y - 20);

            // draw a small dot at the start and end of the line
            ctx.beginPath();
            let randomOffsetX = Math.random() * 16 - 8;
            let randomOffsetY = Math.random() * 16 - 8;
            ctx.arc(edge.startVertex.x + randomOffsetX, edge.startVertex.y + randomOffsetY, 3, 0, Math.PI * 2);
            ctx.arc(edge.endVertex.x + randomOffsetX, edge.endVertex.y + randomOffsetY, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#000';
            ctx.fill();
            ctx.closePath();
        }
    }

    function getState() {
        return {
            vertices: vertices,
            edges: edges,
            edgesSplitUp: edgesSplitUp,
            polygons: polygons
        }
    }

    return {
        changeMode: changeMode,
        drawGraph: drawGraph,
        getState: getState,
        addUpdateListener: addUpdateListener,
        addModeChangedListener: addModeChangedListener,
        visualizationOptions: visualizationOptions
    }
}