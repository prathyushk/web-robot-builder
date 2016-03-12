var container;
var camera, control, orbit, scene, renderer, stl_loader, gui, rightpanel, subprops, componentName;
var subcomponents = [];
var connectedSubcomponents = [];
var componentObj;
var componentLibrary = {};
var componentMenus = {};
var parameters = {};
var connections = [];
var tempParams = {};

var raycaster = new THREE.Raycaster();
raycaster.linePrecision = 3;
var mouse = new THREE.Vector2(),
    offset = new THREE.Vector3(),
    SELECTED_2, SELECTED;

$("#dialog").dialog({autoOpen: false});
componentName = ""
do{
    componentName = window.prompt("Name the component", "");
}
while(componentName == "");
init();
render();

function splitComponent()
{
    scene.remove(componentObj);
    delete componentObj;
    componentObj = undefined;
    while(connectedSubcomponents.length > 0){
	scene.add(connectedSubcomponents[connectedSubcomponents.length-1]);
	subcomponents.push(connectedSubcomponents[connectedSubcomponents.length-1]);
	connectedSubcomponents.splice(connectedSubcomponents.length-1,1);
    }
    document.getElementById("sComp").disabled = true;
}

function downloadSVG(){
    if(UrlExists("models/" + componentName + "/graph-print.svg"))
	window.open("models/" + componentName + "/graph-print.svg");
}

function downloadYaml(){
    if(UrlExists("models/" + componentName + "/" + componentName +".yaml"))
	window.open("models/" + componentName + "/" + componentName +".yaml");
}

function downloadModel(){
    if(UrlExists("models/" + componentName + "/graph-model.stl"))
	window.open("models/" + componentName + "/graph-model.stl");
}

function addConnection(){
    $("#dialog").dialog("close");
    var newConn = {};
    newConn.name = document.getElementById("connName").value;
    for(var iter = 0, len = connections.length; iter < len; iter++){
	if(connections[iter].name == newConn.name){
	    window.alert('Connection with name "' + newConn.name + '" already exists');
	    return;
	}
    }
    var i1Select = document.getElementById("interface1");
    var i2Select = document.getElementById("interface2");
    newConn.interface1 = i1Select.options[i1Select.selectedIndex].text;
    newConn.interface2 = i2Select.options[i2Select.selectedIndex].text;
    connections.push(newConn);
    var folder = comp.connections.addFolder(newConn.name);
    newConn.args = "";
    folder.add(newConn,"interface2").name(newConn.interface1);
    folder.add(newConn,"args");
}

function UrlExists(url)
{
    var http = new XMLHttpRequest();
    http.open('HEAD', url, false);
    http.send();
    return http.status!=404;
}

function removeDuplicates(list){
    for(var ele = 0; ele < list.length; ele++){
	for(var ele2 = 0; ele2 < list.length; ele2++){
	    if(ele != ele2 && list[ele].x == list[ele2].x && list[ele].y == list[ele2].y && list[ele].z == list[ele2].z){
		list.splice(ele2,1);
		ele2--;
	    }
	}
    }
}

function createMeshFromObject(obj)
{
    var material = new THREE.MeshPhongMaterial( { color:0xffffff, shading: THREE.FlatShading } );
    var geometry = new THREE.Geometry();
    for(var face in obj["faces"]){
	transf = new THREE.Matrix4();
	obj["faces"][face][0] = obj["faces"][face][0].map(function(i){return i.replaceAll("**","^")})
	transf.elements = obj["faces"][face][0].map(function(i){return evalExpression(i,obj["solved"]).value});
	transf.transpose();
	var vertices = [];
	set = new Set();
	var holes = [];
	for(var v = 0, len = obj["faces"][face][1]["vertices"].length; v < len; v++){
	    try{
		obj["faces"][face][1]["vertices"][v] = obj["faces"][face][1]["vertices"][v].map(function(i){if(typeof i == 'string' || i instanceof String)return i.replaceAll("**","^"); else return i;});
	    } catch (err){console.log(face + " " +v);}
	    var arr = obj["faces"][face][1]["vertices"][v].map(function(i){return evalExpression(i,obj["solved"]).value});
	    set.add(arr[0] + ","+arr[1]);
	}
	if(set.size < 3)
	    continue;
	var iter = set.values();
	while(1){
	    var element = iter.next();
	    if(element["done"] == true)
		break;
	    var period = element["value"].indexOf(",");
	    vertices.push(new THREE.Vector3(Number(element["value"].substring(0,period)),Number(element["value"].substring(period+1)),0));
	}
	var numverts = geometry.vertices.length;
	console.log(transf);
	var triangles = THREE.Shape.Utils.triangulateShape ( vertices, holes );
	for(var v = 0, len = vertices.length; v < len; v++){
	    var vert = new THREE.Vector4(vertices[v].x,vertices[v].y,0,1);
	    vert.applyMatrix4(transf);
	    console.log(vert);
	    vertices[v].x = vert.x; vertices[v].y = vert.y; vertices[v].z = vert.z;
	}
	geometry.vertices = geometry.vertices.concat(vertices);
	for(var t = 0, len = triangles.length; t < len; t++){
	    geometry.faces.push(new THREE.Face3(triangles[t][0]+numverts, triangles[t][1]+numverts, triangles[t][2]+numverts));
	}
    }
    return new THREE.Mesh( geometry, material );
}

function loadSymbolic(obj){
    for(var i = 0,len = obj["relations"].length; i < len; i++)
	obj["relations"][i] = obj["relations"][i].replaceAll("**","^");
    nupe = obj;
    obj["solved"] = solveSystem(obj["relations"],obj["defaults"])[1];
    var objMesh = createMeshFromObject(obj);
    var n = window.prompt("Subcomponent Name","");
    if(n == "")
	return;
    var joined = subcomponents.concat(connectedSubcomponents);
    for(var iter = 0,len=joined.length; iter < len; iter++){
	if(joined[iter].name == n){
	    window.alert('Subcomponent with name "' + n + '" already exists');
	    return;
	}
    }
    objMesh.name = n;
    objMesh.className = compName;
    objMesh.interfaces = {};
    objMesh.interfaceEdges = obj["interfaceEdges"];
    objMesh.parameterfuncs = {};
    subcomponents.push(objMesh);
    for(i in objMesh.interfaceEdges){
	for(var j = 0, len =objMesh.interfaceEdges[i].length; j < len; j++){
	    if(objMesh.interfaceEdges[i][j] == null)
		continue;
	    var material = new THREE.LineBasicMaterial({
		color: 0xff0000
	    });
	    var geometry = new THREE.Geometry();
	    var k = objMesh.interfaceEdges[i][j];
	    var p1 = [], p2 = [];
	    for(var p = 0; p < 2; p++){
		for(var c = 0; c < 3; c++){
		    obj["edges"][k][p][c] = obj["edges"][k][p][c].replaceAll("**","^");
		    if(p == 0)
			p1.push(evalExpression(obj["edges"][k][p][c],obj["solved"]).value);
		    else
			p2.push(evalExpression(obj["edges"][k][p][c],obj["solved"]).value);
		}
	    }
	    geometry.vertices.push(
		new THREE.Vector3( p1[0], p1[1], p1[2] ),
		new THREE.Vector3( p2[0], p2[1], p2[2] )
	    );
	    var line = new THREE.Line( geometry, material );
	    line.name = i;
	    objMesh.add(line);
	}
    }
    comp.subcomponents[objMesh.name] = comp.subcomponents.addFolder(objMesh.name);
    var constrs = comp.subcomponents[objMesh.name].addFolder("Constraints");
    picoModule.getParameters(compName,function(response){
	objMesh.parameters = response;
	for(i in objMesh.parameters){
	    var f = constrs.addFolder(i);
	    if(objMesh.parameters[i] == null)
		objMesh.parameters[i] = "";
	    objMesh.parameterfuncs[i] = "";
	    f.add(objMesh.parameters,i).name("Value");
	    f.add(objMesh.parameterfuncs,i).name("Function");
	}
    });
    for(i in componentLibrary[objMesh.className].interfaces){
	objMesh.interfaces[componentLibrary[objMesh.className].interfaces[i]] = false;
    }
    scene.add(objMesh);
    var ints = comp.subcomponents[objMesh.name].addFolder("Inherit Interfaces");
    for(i in objMesh.interfaces){
	var contr = ints.add(objMesh.interfaces,i)
	contr.name(i);
    }
}

function onLoadSTL(geometry){
    var n = window.prompt("Subcomponent Name","");
    if(n == "")
	return;
    var joined = subcomponents.concat(connectedSubcomponents);
    for(var iter = 0,len=joined.length; iter < len; iter++){
	if(joined[iter].name == n){
	    window.alert('Subcomponent with name "' + n + '" already exists');
	    return;
	}
    }
    var material = new THREE.MeshPhongMaterial( { color:0xffffff, shading: THREE.FlatShading } );
    var obj = new THREE.Mesh(geometry,material);
    obj.name = n;
    obj.className = compName;
    obj.interfaces = {};
    obj.interfaceEdges = interfaceEdges;
    obj.parameterfuncs = {};
    subcomponents.push(obj);
    for(i in interfaceEdges){
	for(j in interfaceEdges[i]){
	    if(interfaceEdges[i][j] == null)
		continue;
	    var material = new THREE.LineBasicMaterial({
		color: 0xff0000
	    });
	    var geometry = new THREE.Geometry();
	    geometry.vertices.push(
		new THREE.Vector3( interfaceEdges[i][j][0][0], interfaceEdges[i][j][0][1], interfaceEdges[i][j][0][2] ),
		new THREE.Vector3( interfaceEdges[i][j][1][0], interfaceEdges[i][j][1][1], interfaceEdges[i][j][1][2] )
	    );
	    var line = new THREE.Line( geometry, material );
	    line.name = i;
	    obj.add(line);
	}
    }
    comp.subcomponents[obj.name] = comp.subcomponents.addFolder(obj.name);
    var constrs = comp.subcomponents[obj.name].addFolder("Constraints");
    picoModule.getParameters(compName,function(response){
	obj.parameters = response;
	for(i in obj.parameters){
	    var f = constrs.addFolder(i);
	    if(obj.parameters[i] == null)
		obj.parameters[i] = "";
	    obj.parameterfuncs[i] = "";
	    f.add(obj.parameters,i).name("Value");
	    f.add(obj.parameterfuncs,i).name("Function");
	}
    });
    for(i in componentLibrary[obj.className].interfaces){
	obj.interfaces[componentLibrary[obj.className].interfaces[i]] = false;
    }
    scene.add(obj);
    var ints = comp.subcomponents[obj.name].addFolder("Inherit Interfaces");
    for(i in obj.interfaces){
	var contr = ints.add(obj.interfaces,i)
	contr.name(i);
    }
}

function onComponentSTL(geometry){
    if(componentObj)
	scene.remove(componentObj);
    material = new THREE.MeshPhongMaterial( {color:0xffffff,shading:THREE.FlatShading});
    componentObj = new THREE.Mesh(geometry,material);
    scene.add(componentObj);
}

function handleError(e){
    var ind = e.exception.search("Parameter ");
    if(ind != -1){
	var param = [];
	if(e.exception.charAt(ind+10) == '[')
	    param = eval(e.exception.substring(ind+10,e.exception.search(']')+1))
	else{
	    var strip = e.exception.substring(ind+10);
	    param.push(strip.substring(0,strip.search(' ')));
	}
	for(var i = 0, len = param.length; i < len; i++){
	    var val = window.prompt("Set value for parameter " + param[i]);
	    if(val == "")
		return;
	    tempParams[param[i]] = parseInt(val);
	}
	var args = [compName,tempParams];
	picoModule.generate_stl(args, function(response){
	    tempParams = {};
	    console.log(response);
	    interfaceEdges = response;
	    stl_loader.load('models/' + compName + '/graph-model.stl',onLoadSTL);
	});
    }
    else
	window.alert(e.exception);
}

function getComponents()
{
    pico.on_error = handleError;
    pico.load("interface", function(module){
	picoModule = module;
	for(var key in componentMenus){
	    module.components([key],function(response){
		var k = response[0];
		for(i = 1; i < response.length; i++){
		    componentLibrary[response[i][0]] = { interfaces: response[i][1] };
		    var button = {
			compName: response[i][0],
			add: function(){
			    compName = this.compName;
			    var args = [this.compName,tempParams];
			    picoModule.getSymbolic(args, function(response){
				tempParams = {};
				loadSymbolic(response);
				/*interfaceEdges = response;
				  stl_loader.load('models/' + compName + '/graph-model.stl',onLoadSTL);*/
			    });
			}
		    }
		    componentMenus[k].add(button,"add").name(response[i][0]);
		}
	    });
	}
    });
}

function init(){
    container = document.getElementById('componentView');
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera( 75, container.clientWidth / container.clientHeight, 0.1, 100000 );
    stl_loader = new THREE.STLLoader();
    renderer = new THREE.WebGLRenderer({alpha: true, antialias: true});
    renderer.setSize( container.clientWidth, container.clientHeight);
    renderer.setClearColor( 0x000000,0);
    container.appendChild( renderer.domElement );

    scene.add( new THREE.GridHelper( 500, 100 ) );
    camera.position.set( 1000, 500, 1000 );
    camera.lookAt( new THREE.Vector3( 0, 200, 0 ) );

    light = new THREE.DirectionalLight( 0xffffff );
    light.position.set( 1, 1, 1 );
    scene.add( light );

    light = new THREE.DirectionalLight( 0x002288 );
    light.position.set( -1, -1, -1 );
    scene.add( light );

    light = new THREE.AmbientLight( 0x222222 );
    scene.add( light );
    control = new THREE.TransformControls( camera, renderer.domElement );
    control.addEventListener( 'change', render );
    orbit = new THREE.OrbitControls( camera, renderer.domElement );
    loadGui();
    getComponents();
    renderer.domElement.addEventListener( 'mousemove', onDocumentMouseMove, false );
    renderer.domElement.addEventListener( 'mousedown', onDocumentMouseDown, false );
    renderer.domElement.addEventListener( 'mouseup', onDocumentMouseUp, false );

    window.addEventListener( 'resize', onWindowResize, false );
    window.addEventListener( 'keydown', onKeyDown);
}

function removeByName(array,name){
    for(var i = 0, len = array.length; i < len; i++){
	if(array[i].name == name){
	    array.splice(i,1);
	    break;
	}
    }
}

function loadGui() {
    var search = {
	Search: ""
    };
    var filters = {
	Mechanical: true,
	Electrical: true,
	Software: true
    };
    gui = new dat.GUI({ autoPlace: false, width: document.getElementById('left-panel').clientWidth, scrollable: true });
    gui.domElement.removeChild(gui.__closeButton);
    document.getElementById('left-panel').appendChild(gui.domElement);
    gui.add(search, "Search");
    searchFilters = gui.addFolder("Filters");
    searchFilters.add(filters, "Mechanical");
    searchFilters.add(filters, "Electrical");
    searchFilters.add(filters, "Software");
    componentsFolder = gui.addFolder('Components');
    componentsFolder.open();
    componentMenus["mechanical"] = componentsFolder.addFolder("Mechanical");
    componentMenus["device"] = componentsFolder.addFolder("Device");
    componentMenus["actuator"] = componentsFolder.addFolder("Actuators");
    componentMenus["sensor"] = componentsFolder.addFolder("Sensors");
    componentMenus["UI"] = componentsFolder.addFolder("UI");
    rightpanel = new dat.GUI({ autoPlace: false, width: document.getElementById('right-panel').clientWidth, scrollable: true });
    rightpanel.domElement.removeChild(rightpanel.__closeButton);
    document.getElementById('right-panel').appendChild(rightpanel.domElement);
    comp = rightpanel.addFolder(componentName);
    comp.open();
    comp.parameters = comp.addFolder("Parameters");
    comp.subcomponents = comp.addFolder("Subcomponents");
    comp.connections = comp.addFolder("Connections");
    var objectbuttons = {
	subcomponentDelete:function(){
	    var delName = window.prompt("Name of subcomponent to delete","");
	    if(delName == "")
		return;
	    for(var i = 0, len = subcomponents.length; i < len; i++){
		if(subcomponents[i].name == delName){
		    if(SELECTED.name == subcomponents[i].name){
			control.detach(subcomponents[i].name);
			SELECTED = undefined;
		    }
		    scene.remove(subcomponents[i]);
		    subcomponents.splice(i,1);
		    break;
		}
	    }
	    removeByName(connectedSubcomponents,delName);
	    comp.subcomponents.removeFolder(delName);
	},
	connectionAdd:function(){
	    if(SELECTED != undefined && SELECTED_2 != undefined && SELECTED.parent != "Scene" && SELECTED_2.parent != "Scene")
	    {
		var newConn = {};
		newConn.name = window.prompt("Connection Name: ");
		for(var iter = 0, len = connections.length; iter < len; iter++){
		    if(connections[iter].name == newConn.name){
			window.alert('Connection with name "' + newConn.name + '" already exists');
			return;
		    }
		}
		newConn.interface1 = SELECTED.parent.name + "." + SELECTED.name;
		newConn.interface2 = SELECTED_2.parent.name + "." + SELECTED_2.name;
		connections.push(newConn);
		var folder = comp.connections.addFolder(newConn.name);
		newConn.args = "";
		folder.add(newConn,"interface2").name(newConn.interface1);
		folder.add(newConn,"args");
	    }
	    else{
		var joinedList = subcomponents.concat(connectedSubcomponents);
		for(i in joinedList){
		    for(inter in joinedList[i].interfaces){
			var opt = document.createElement("option");
			var opt2 = document.createElement("option");
			var str = joinedList[i].name + "." + inter;
			opt.val = str; opt2.val = str;
			opt.innerHTML = str; opt2.innerHTML = str;
			document.getElementById('interface1').appendChild(opt);
			document.getElementById('interface2').appendChild(opt2);
		    }
		}
		$("#dialog").dialog("open");
	    }
	},
	connectionDelete:function(){
	    var delName = window.prompt("Name of connection to delete","");
	    if(delName == "")
		return;
	    removeByName(connections,delName);
	    comp.connections.removeFolder(delName);
	},
	parameterAdd:function(){
	    var fieldName = window.prompt("Parameter name","");
	    if(fieldName == "")
		return;
	    if(parameters[fieldName] != undefined){
		window.alert('Parameter "' + fieldName + '" already exists');
		return;
	    }
	    parameters[fieldName] = "";
	    comp.parameters.add(parameters, fieldName).name(fieldName);
	},
	parameterDelete:function(){
	    var delName = window.prompt("Name of parameter to delete","");
	    if(delName == "")
		return;
	    delete parameters[delName];
	    for(var i = 2, len = comp.parameters.__controllers.length; i < len; i++){
		if(comp.parameters.__controllers[i].__li.firstElementChild.firstElementChild.innerHTML == delName)
		    comp.parameters.remove(comp.parameters.__controllers[i]);
	    }
	}
    }
    comp.subcomponents.add(objectbuttons,'subcomponentDelete').name("Remove");
    comp.parameters.add(objectbuttons,'parameterAdd').name("Add");
    comp.parameters.add(objectbuttons,'parameterDelete').name("Remove");
    comp.connections.add(objectbuttons,'connectionAdd').name("Add");
    comp.connections.add(objectbuttons,'connectionDelete').name("Remove");
}

function stripObjects(list, strippedList){
    for(i in list){
	var strippedObj = {};
	strippedObj.name = list[i].name;
	strippedObj.className = list[i].className;
	strippedObj.parameters = list[i].parameters;
	strippedObj.parameterfuncs = list[i].parameterfuncs;
	strippedObj.interfaces = list[i].interfaces;
	strippedList.push(strippedObj);
    }
}

function buildComponent(){
    var thisComponent = {};
    thisComponent.name = componentName;
    thisComponent.subcomponents = [];
    stripObjects(subcomponents,thisComponent.subcomponents);
    stripObjects(connectedSubcomponents,thisComponent.subcomponents);
    thisComponent.parameters = parameters;
    thisComponent.connections = connections;
    picoModule.generateFromObj(thisComponent,function(response){
	if(SELECTED != undefined){
	    control.detach(SELECTED);
	    SELECTED = undefined;
	}
	while(subcomponents.length > 0){
	    scene.remove(subcomponents[subcomponents.length-1]);
	    connectedSubcomponents.push(subcomponents[subcomponents.length-1]);
	    subcomponents.splice(subcomponents.length-1,1);
	}
	stl_loader.load('models/' + componentName + '/graph-model.stl',onComponentSTL);
	document.getElementById('svg-view').src = 'models/' + componentName + '/graph-print.svg';
	document.getElementById('dSVG').disabled = false;
	document.getElementById('dYaml').disabled = false;
	document.getElementById('dModel').disabled = false;
	document.getElementById('sComp').disabled = false;
    });
}

function onKeyDown( event ) {
    switch ( event.keyCode ) {
	/*    case 81: // Q
	      control.setSpace( control.space === "local" ? "world" : "local" );
	      break;
    case 17: // Ctrl
    control.setTranslationSnap( 100 );
    control.setRotationSnap( THREE.Math.degToRad( 15 ) );
    break;
    case 87: // W
    control.setMode( "translate" );
    break;
    case 69: // E
    control.setMode( "rotate" );
    break;
    case 82: // R
    control.setMode( "scale" );
    break;
    case 187:
    case 107: // +, =, num+
    control.setSize( control.size + 0.1 );
    break;
    case 189:
    case 109: // -, _, num-
    control.setSize( Math.max( control.size - 0.1, 0.1 ) );
    break;
    case 66: // B
    buildComponent();
    break;*/
    }
}

function onWindowResize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( container.clientWidth, container.clientHeight );
    document.getElementById('left-panel').style.height = window.innerHeight;
}

function getLeftPos(el) {
    for (var leftPos = 0;
	 el != null;
	 leftPos += el.offsetLeft, el = el.offsetParent);
    return leftPos;
}

function onDocumentMouseMove( event ) {
    event.preventDefault();
    mouse.x = ( (event.clientX - getLeftPos(container))/ container.clientWidth ) * 2 - 1;
    mouse.y = - ( event.clientY / container.clientHeight ) * 2 + 1;
    raycaster.setFromCamera( mouse, camera );
    var objs = subcomponents;
    if(componentObj != undefined)
	objs = subcomponents.concat(componentObj);
    var intersects = raycaster.intersectObjects( objs,true );
    if ( intersects.length > 0 ) {
	container.style.cursor = 'pointer';
    } else {
	container.style.cursor = 'auto';
    }
}

function onDocumentMouseDown( event ) {
    event.preventDefault();
    raycaster.setFromCamera( mouse, camera );
    var objs = subcomponents;
    if(componentObj != undefined)
	objs = subcomponents.concat(componentObj);
    var intersects = raycaster.intersectObjects( objs,true );
    var obj;
    if(!event.shiftKey)
	obj = SELECTED;
    else
	obj = SELECTED_2;
    if ( intersects.length > 0 ) {
	if(obj != undefined && obj.parent.type != "Scene")
	{
	    obj.material.color = new THREE.Color(0xff0000);
	    if(!event.shiftKey)
		SELECTED = undefined;
	    else
		SELECTED_2 = undefined;
	}
	if(intersects[0].object.parent.type != "Scene"){
	    intersects[0].object.material.color = new THREE.Color(0x00ff00);
	    if(!event.shiftKey){
		if(SELECTED != undefined && SELECTED.parent.type == "Scene")
		    control.detach(SELECTED);
		SELECTED = intersects[0].object;
	    }
	    else
		SELECTED_2 = intersects[0].object;
	}
	else
	{
	    control.attach(intersects[0].object);
	    scene.add(control);
	    comp.subcomponents.open();
	    if(SELECTED != undefined)
		comp.subcomponents[SELECTED.name].close();
	    if(SELECTED != componentObj)
		comp.subcomponents[intersects[0].object.name].open();
	    var string = "models/" + intersects[0].object.className + "/graph-print.svg";
	    document.getElementById('svg-view').src = string;
	    SELECTED = intersects[0].object;
	}
    }
}

function onDocumentMouseUp( event ) {
    event.preventDefault();
}

function render() {
    requestAnimationFrame(render);
    control.update();
    renderer.render( scene, camera );
}

dat.GUI.prototype.removeFolder = function(name) {
    var folder = this.__folders[name];
    if (!folder) {
	return;
    }
    folder.close();
    this.__ul.removeChild(folder.domElement.parentNode);
    delete this.__folders[name];
    this.onResize();
}

String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.split(search).join(replacement);
};
