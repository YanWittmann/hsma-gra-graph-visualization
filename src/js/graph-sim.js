const Mode = {
    ADD_VERTEX: 'add_vertex',
    ADD_EDGE: 'add_edge',
    ADD_EDGE_REDIRECT: 'add_edge_redirect',
    REMOVE_ELEMENT: 'remove_edge',
    MOVE_VERTEX: 'move_vertex'
};

function initializeGraphSim(canvasId) {

    const isMobile = 'ontouchstart' in window;

    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
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
        showEdgeNames: false,
        debugEdges: false,
        debugVertices: false,
    }

    let currentMode = Mode.ADD_VERTEX;
    let isMouseDown = false;

    function loadGraph(verticesData, edgesData, nonExistentVerticesData) {
        if (!verticesData || !edgesData) {
            console.warn('Invalid graph data', verticesData, edgesData);
            return;
        }
        vertices = verticesData;
        nonExistentVertices = nonExistentVerticesData;
        // find for each edge the corresponding vertex in the vertices array if present and replace by instance so that operations like moving vertices work to maintain the reference
        edgesData = edgesData.map(edge => {
            const startVertex = vertices.find(vertex => vertex.x === edge.startVertex.x && vertex.y === edge.startVertex.y);
            const endVertex = vertices.find(vertex => vertex.x === edge.endVertex.x && vertex.y === edge.endVertex.y);
            if (startVertex) {
                edge.startVertex = startVertex;
            } else {
                const nonExistentStartVertex = nonExistentVerticesData.find(vertex => vertex.x === edge.startVertex.x && vertex.y === edge.startVertex.y);
                if (nonExistentStartVertex) {
                    edge.startVertex = nonExistentStartVertex;
                }
            }
            if (endVertex) {
                edge.endVertex = endVertex;
            } else {
                const nonExistentEndVertex = nonExistentVerticesData.find(vertex => vertex.x === edge.endVertex.x && vertex.y === edge.endVertex.y);
                if (nonExistentEndVertex) {
                    edge.endVertex = nonExistentEndVertex;
                }
            }
            return edge;
        });
        edges = edgesData;
        drawGraph();
    }

    function drawVertex(vertex) {
        const x = vertex.x;
        const y = vertex.y;
        const color = vertex.color;

        ctx.beginPath();
        ctx.fillStyle = '#000';
        ctx.arc(x, y, vertexRadius + 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();

        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.arc(x, y, vertexRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();

        if (visualizationOptions.showEdgeNames) {
            ctx.font = "18px Arial";
            const backgroundLightness = (parseInt(color.substring(1, 3), 16) + parseInt(color.substring(3, 5), 16) + parseInt(color.substring(5, 7), 16)) / 3;
            ctx.fillStyle = backgroundLightness > 100 ? '#000' : '#fff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(vertex.name || '', x, y);
        }
    }

    function drawEdge(startVertex, endVertex, colorMode = true) {
        ctx.beginPath();
        ctx.strokeStyle = colorMode ? '#000' : '#000';
        ctx.lineWidth = edgeWidth;
        ctx.moveTo(startVertex.x, startVertex.y);
        ctx.lineTo(endVertex.x, endVertex.y);
        ctx.stroke();
        ctx.closePath();
    }

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
                // count the amount of edges connected to the intersection.
                // - if it's 2, it's a redirect point
                // - if it's more than 2, it's an intersection between multiple edges and should be marked in red
                const connectedEdges = edgesSplitUp.newEdges.filter(edge => {
                    return edge.startVertex.x === intersection.x && edge.startVertex.y === intersection.y ||
                        edge.endVertex.x === intersection.x && edge.endVertex.y === intersection.y;
                });
                ctx.fillStyle = connectedEdges.length > 2 ? '#cc0000' : '#000';
                ctx.fill();
                ctx.closePath();
            }
        }

        if (visualizationOptions.showVertices) {
            const sortedByColorVertices = vertices.sort((a, b) => {
                return a.color?.localeCompare(b.color || '') || 0;
            });
            if (visualizationOptions.showEdgeNames) {
                const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
                sortedByColorVertices.forEach((vertex, index) => {
                    vertex.name = alphabet[index % alphabet.length];
                });
            }

            for (const vertex of sortedByColorVertices) {
                drawVertex(vertex);
            }
        }

        if (!isMouseDown) {
            drawDebugItems(edgesSplitUp);
        }

        for (const listener of updateListeners) {
            listener(getState());
        }
    }

    let selectedVertex = null;
    let draggedVertex = null;
    let draggedStart = null; // {x: number, y: number}

    function touchEventExtractPosition(event) {
        if (event.type === 'touchstart' || event.type === 'touchmove' || event.type === 'touchend'
            || event.type === 'touchcancel') {
            const touch = event.touches[0] || event.changedTouches[0];
            event.clientX = touch.pageX;
            event.clientY = touch.pageY;
        }
    }

    function handleMouseDown(event) {
        if (!isMouseDown) {
            isMouseDown = true;
        }
        touchEventExtractPosition(event);

        const rect = canvas.getBoundingClientRect();
        let mouseX = event.clientX - rect.left;
        let mouseY = event.clientY - rect.top;

        ({ mouseX, mouseY } = snapPositionToGrid(event, mouseX, mouseY));

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
            for (const vertex of vertices) {
                const distance = Math.sqrt((mouseX - vertex.x) ** 2 + (mouseY - vertex.y) ** 2);
                if (distance <= vertexRadius) {
                    vertices = vertices.filter(v => v !== vertex);
                    // Also remove any edges connected to the vertex
                    edges = edges.filter(e => e.startVertex !== vertex && e.endVertex !== vertex);
                    return;
                }
            }
            for (const edge of edges) {
                const distance = distanceToLine(mouseX, mouseY, edge.startVertex, edge.endVertex);
                if (distance <= 10) { // threshold for easier selection
                    edges = edges.filter(e => e !== edge);
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

        drawGraph();
    }

    function handleMouseMove(event) {
        touchEventExtractPosition(event);

        const rect = canvas.getBoundingClientRect();
        let mouseX = event.clientX - rect.left;
        let mouseY = event.clientY - rect.top;

        ({ mouseX, mouseY } = snapPositionToGrid(event, mouseX, mouseY));

        if ((currentMode === Mode.ADD_EDGE || currentMode === Mode.ADD_EDGE_REDIRECT) && selectedVertex) {
            // If in add edge mode and a vertex is selected, draw a temporary edge
            drawGraph();
            drawEdge(selectedVertex, { x: mouseX, y: mouseY });
        } else if (currentMode === Mode.MOVE_VERTEX && draggedVertex) {
            draggedVertex.x += mouseX - draggedStart.x;
            draggedVertex.y += mouseY - draggedStart.y;
            draggedStart = { x: mouseX, y: mouseY };
            drawGraph();
        }
    }

    function handleMouseUp(event) {
        if (isMouseDown) {
            isMouseDown = false;
        }
        touchEventExtractPosition(event);

        if ((currentMode === Mode.ADD_EDGE || currentMode === Mode.ADD_EDGE_REDIRECT) && selectedVertex) {
            // If in add edge mode and a vertex is selected, find the end vertex under the mouse
            const rect = canvas.getBoundingClientRect();
            let mouseX = event.clientX - rect.left;
            let mouseY = event.clientY - rect.top;
            ({ mouseX, mouseY } = snapPositionToGrid(event, mouseX, mouseY));

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
            if (!foundVertex && !isMobile) {
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

            // remove duplicate edges (no matter the direction)
            edges = edges.filter((edge, index) => {
                for (let i = 0; i < edges.length; i++) {
                    const otherEdge = edges[i];
                    if (edge.startVertex === otherEdge.endVertex && edge.endVertex === otherEdge.startVertex) {
                        return i < index;
                    }
                }
                return true;
            });
        } else if (currentMode === Mode.MOVE_VERTEX && draggedVertex) {
            draggedVertex = null;
        }

        drawGraph();
    }

    function snapPositionToGrid(event, mouseX, mouseY) {
        // check if user is holding shift to snap to vertical/horizontal alignment with previous vertex
        const intervalSize = 50;
        if (event.shiftKey) {
            const lastPosition = draggedVertex || selectedVertex;
            if (lastPosition) {
                const distanceX = Math.abs(mouseX - lastPosition.x);
                const distanceY = Math.abs(mouseY - lastPosition.y);
                if (distanceX < distanceY) {
                    mouseX = lastPosition.x;
                } else {
                    mouseY = lastPosition.y;
                }
            }

            // snap to grid
            mouseX = Math.round(mouseX / intervalSize) * intervalSize;
            mouseY = Math.round(mouseY / intervalSize) * intervalSize;
        }

        return { mouseX, mouseY };
    }

    function distanceToLine(x, y, startVertex, endVertex) {
        const numerator = Math.abs((endVertex.y - startVertex.y) * x - (endVertex.x - startVertex.x) * y + endVertex.x * startVertex.y - endVertex.y * startVertex.x);
        const denominator = Math.sqrt((endVertex.y - startVertex.y) ** 2 + (endVertex.x - startVertex.x) ** 2);
        return numerator / denominator;
    }

    function getRandomColor() {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }

    function changeMode(newMode) {
        currentMode = newMode;
        if (currentMode === Mode.ADD_EDGE) {
            selectedVertex = null;
        }
        for (const listener of modeChangedListeners) {
            listener(currentMode);
        }

        // depending on the mode, set the mouse cursor when it hovers over the canvas
        if (currentMode === Mode.ADD_VERTEX) {
            canvas.style.cursor = 'crosshair';
        } else if (currentMode === Mode.ADD_EDGE || currentMode === Mode.ADD_EDGE_REDIRECT) {
            canvas.style.cursor = 'crosshair';
        } else if (currentMode === Mode.REMOVE_ELEMENT) {
            canvas.style.cursor = 'not-allowed';
        } else if (currentMode === Mode.MOVE_VERTEX) {
            canvas.style.cursor = 'move';
        }
    }

    document.addEventListener('keydown', event => {
        if (event.key === '1' || event.key === 'a') {
            changeMode(Mode.ADD_VERTEX);
        } else if (event.key === '2' || event.key === 'e' || event.key === 'c') {
            if (currentMode === Mode.ADD_EDGE) {
                changeMode(Mode.ADD_EDGE_REDIRECT);
            } else {
                changeMode(Mode.ADD_EDGE);
            }
        } else if (event.key === '3' || event.key === 'b') {
            changeMode(Mode.ADD_EDGE_REDIRECT);
        } else if (event.key === '4' || event.key === 'r') {
            changeMode(Mode.REMOVE_ELEMENT);
        } else if (event.key === '5' || event.key === 'g') {
            changeMode(Mode.MOVE_VERTEX);
        } else if (event.key === 'q') {
            visualizationOptions.debugEdges = !visualizationOptions.debugEdges;
            drawGraph();
        } else if (event.key === 'w') {
            visualizationOptions.debugVertices = !visualizationOptions.debugVertices;
            drawGraph();
        } else if (event.key === 'Escape') {
            selectedVertex = null;
            draggedVertex = null;
            drawGraph();
        } else if (event.key === 'd') {
            // export graph into png and download, crop the canvas to the graph by finding the max and min x and y values and adding the vertex radius as padding
            const minX = Math.min(...vertices.map(vertex => vertex.x)) - vertexRadius * 2;
            const maxX = Math.max(...vertices.map(vertex => vertex.x)) + vertexRadius * 2;
            const minY = Math.min(...vertices.map(vertex => vertex.y)) - vertexRadius * 2;
            const maxY = Math.max(...vertices.map(vertex => vertex.y)) + vertexRadius * 2;
            const width = maxX - minX;
            const height = maxY - minY;
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(canvas, minX, minY, width, height, 0, 0, width, height);
            const link = document.createElement('a');
            link.download = 'graph-' + polygons.length + '-' + vertices.length + '-' + edges.length + '.png';
            link.href = tempCanvas.toDataURL();
            link.click();
        }
    });

    // computer mouse events if on computer
    if (!isMobile) {
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseup', handleMouseUp);
    }
    // mobile touch events if on mobile
    else {
        canvas.addEventListener('touchstart', handleMouseDown);
        canvas.addEventListener('touchmove', handleMouseMove);
        canvas.addEventListener('touchend', handleMouseUp);
    }


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
                        // add the intersection point if it's not already present
                        const existingIntersection = intersections.find(point => point.x === intersection.x && point.y === intersection.y);
                        if (!existingIntersection) {
                            intersections.push(intersection);
                        }
                    }
                }
            }
            // sort the intersection points based on their distance from the starting vertex
            intersections.sort((a, b) => distance(p1, a) - distance(p1, b));
            // split the edge into segments using the intersection points
            let prevVertex = p1;
            for (const intersection of intersections) {
                newEdges.push({ startVertex: prevVertex, endVertex: intersection });
                prevVertex = intersection;
            }
            allIntersections = new Set([...allIntersections, ...intersections]);
            newEdges.push({ startVertex: prevVertex, endVertex: p2 });
        }

        // make unique, do compare edges by x and by y to prevent duplicates, also check for reversed edges and deduplicate them too
        // also find those that have the same start and end vertex and remove them
        newEdges = newEdges.filter((edge, index) => {
            for (let i = 0; i < newEdges.length; i++) {
                const otherEdge = newEdges[i];
                if (edge.startVertex.x === otherEdge.endVertex.x && edge.startVertex.y === otherEdge.endVertex.y &&
                    edge.endVertex.x === otherEdge.startVertex.x && edge.endVertex.y === otherEdge.startVertex.y) {
                    return false;
                }
            }
            if (edge.startVertex.x === edge.endVertex.x && edge.startVertex.y === edge.endVertex.y) {
                console.warn('Edge with same start and end vertex', edge)
                return false;
            }
            return true;
        });

        return {
            newEdges: newEdges,
            intersections: Array.from(allIntersections)
        };
    }

    function isVertex(point) {
        return vertices.some(vertex => vertex.x === point.x && vertex.y === point.y);
    }

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

    function distance(p1, p2) {
        return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
    }


    function findPolygons(edges) {
        // https://www.inesc-id.pt/ficheiros/publicacoes/936.pdf
        // Writing this code took me over 10 hours and I think it woks now, at least in 99% of the cases I tested.
        const graph = buildGraphFromEdges(edges);
        const cycles = findCycles(graph);
        const polygons = convertCyclesToPolygons(cycles);
        return filterPolygons(polygons)
            .sort((a, b) => polygonArea(b) - polygonArea(a));
    }

    function buildGraphFromEdges(edges) {
        const graph = {};

        for (const edge of edges) {
            const startKey = `${edge.startVertex.x.toFixed(4)},${edge.startVertex.y.toFixed(4)}`;
            const endKey = `${edge.endVertex.x.toFixed(4)},${edge.endVertex.y.toFixed(4)}`;

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

        function dfs(vertex, path, indent = ' ') {
            visited.add(vertex);
            path.push(vertex);
            // console.log(indent, 'calling dfs', vertex, path);
            // console.log(indent, 'available neighbors', graph[vertex]);

            for (const neighbor of graph[vertex]) {
                // console.log(indent, 'checking neighbor', neighbor, path);
                if (!visited.has(neighbor)) {
                    dfs(neighbor, path, indent + ' |');
                } else if (path.length > 2 && neighbor === path[0]) {
                    // console.log(indent, 'found cycle', path);
                    cycles.push([...path]);
                } else {
                    // console.log(indent, 'not a cycle', path);
                }
            }

            path.pop();
            visited.delete(vertex);
        }

        for (const vertex in graph) {
            if (!visited.has(vertex)) {
                // console.warn('starting checking vertex', vertex);
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
        // console.log('removed duplicates', duplicates)
        const containerPoints = removeContainerPointPolygons(duplicates);
        return removeContainerPolygons(containerPoints);
    }

    function removeContainerPolygons(polygons) {
        const filteredPolygons = [];
        let lenience = -0.1;

        // sort polygons array by area, start with smallest
        polygons.sort((a, b) => polygonArea(a) - polygonArea(b));

        // Iterate through each polygon
        for (let i = 0; i < polygons.length; i++) {
            const polygon = polygons[i];
            const polygonAreaValue = polygonArea(polygon);
            let otherPolygonsAreaSum = 0;
            let containedPolygons = [];

            // Check if the current polygon contains any point from other polygons
            for (let j = 0; j < polygons.length; j++) {
                if (i !== j) {
                    const otherPolygon = polygons[j];

                    // Check if any point from the other polygon is inside the current polygon
                    for (const point of otherPolygon) {
                        if (isPointInsidePolygon(point, polygon) && !isPointInPolygonPoints(point, polygon)) {
                            otherPolygonsAreaSum += polygonArea(otherPolygon);
                            containedPolygons.push(otherPolygon);
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
                // console.log("Container polygon not found", polygon, otherPolygonsAreaSum, '<=', polygonAreaValue + lenience, containedPolygons)
                filteredPolygons.push(polygon);
            } else {
                // console.log("Container polygon found", polygon, otherPolygonsAreaSum, '>', polygonAreaValue + lenience, containedPolygons);
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

    function drawDebugItems(edgesSplitUp) {
        const intersections = edgesSplitUp.intersections;
        const edges = edgesSplitUp.newEdges;

        // draw each line in a different color with a thickness of 2
        for (let i = 0; i < edges.length; i++) {
            const edge = edges[i];

            ctx.font = "12px Arial";
            if (visualizationOptions.debugVertices) {
                // write as text the coordinates of the start and end of the line rounded to 2 decimal places
                ctx.fillStyle = '#000';
                ctx.fillText(`(${edge.startVertex.x.toFixed(2)}, ${edge.startVertex.y.toFixed(2)})`, edge.startVertex.x + 20, edge.startVertex.y - 20);
                ctx.fillText(`(${edge.endVertex.x.toFixed(2)}, ${edge.endVertex.y.toFixed(2)})`, edge.endVertex.x + 20, edge.endVertex.y - 20);
            }

            // draw the index of the lines
            if (visualizationOptions.debugEdges) {
                ctx.beginPath();
                ctx.moveTo(edge.startVertex.x, edge.startVertex.y);
                ctx.lineTo(edge.endVertex.x, edge.endVertex.y);
                ctx.strokeStyle = getRandomColor();
                ctx.lineWidth = 3;
                ctx.stroke();
                ctx.closePath();

                // make a white background for the text to make it more readable
                ctx.fillStyle = 'rgba(255,255,255,0.7)';
                ctx.fillRect((edge.startVertex.x + edge.endVertex.x) / 2 - 5, (edge.startVertex.y + edge.endVertex.y) / 2 - 12, 20, 16);
                ctx.fillStyle = '#000';
                ctx.fillText(i + '', ((edge.startVertex.x + edge.endVertex.x) / 2) - 3, (edge.startVertex.y + edge.endVertex.y) / 2);
            }
        }
    }

    function getState() {
        return {
            vertices: vertices,
            nonExistentVertices: nonExistentVertices,
            edges: edges,
            edgesSplitUp: edgesSplitUp,
            polygons: polygons
        }
    }

    function clearGraph() {
        vertices = [];
        edges = [];
        nonExistentVertices = [];
        drawGraph();
    }

    drawGraph();

    return {
        changeMode: changeMode,
        drawGraph: drawGraph,
        getState: getState,
        loadGraph: loadGraph,
        clearGraph: clearGraph,
        addUpdateListener: addUpdateListener,
        addModeChangedListener: addModeChangedListener,
        visualizationOptions: visualizationOptions
    }
}