var container;
var camera, control, orbit, scene, renderer, stl_loader, gui, rightpanel, subprops, componentName;
var subcomponents = [];
var connectedSubcomponents = [];
var componentObj;
var componentLibrary = {};
var componentMenus = {};
var parameters = {};
var connections = [];
      
var raycaster = new THREE.Raycaster();
var mouse = new THREE.Vector2(),
offset = new THREE.Vector3(),
INTERSECTED, SELECTED;

$("#dialog").dialog({autoOpen: false});
componentName = ""
do{
    componentName = window.prompt("Name the component", "");
}
while(componentName == "");
init();
render();

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
    obj.parameterfuncs = {};
    subcomponents.push(obj);
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

function getComponents()
{
    pico.on_error = function(e){ window.alert(e.exception); }
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
			    if(UrlExists("models/" + this.compName + "/graph-model.stl"))
				stl_loader.load('models/' + this.compName + '/graph-model.stl',onLoadSTL);
			    else
				module.generate_stl(this.compName,function(response){
				    if(response)
					stl_loader.load('models/' + compName + '/graph-model.stl',onLoadSTL);
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
        if(array[i].name == name)
            array.splice(i,1);
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
		    if(SELECTED == subcomponents[i].name){
			control.detach(subcomponents[i].name);
			SELECTED = undefined;
		    }
		    scene.remove(subcomponents[i]);
		    subcomponents.splice(i,1);
		}
	    }
	    removeByName(connectedSubcomponents,delName);
	    comp.subcomponents.removeFolder(delName);
	},
	connectionAdd:function(){
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
    comp.subcomponents.add(objectbuttons,'subcomponentDelete').name("Remove Subcomponent");
    comp.parameters.add(objectbuttons,'parameterAdd').name("Add Parameter");
    comp.parameters.add(objectbuttons,'parameterDelete').name("Remove Parameter");
    comp.connections.add(objectbuttons,'connectionAdd').name("Add Connection");
    comp.connections.add(objectbuttons,'connectionDelete').name("Remove Connection");
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
    var intersects = raycaster.intersectObjects( subcomponents );
    if ( intersects.length > 0 ) {
	container.style.cursor = 'pointer';
    } else {
	container.style.cursor = 'auto';
    }
}

function onDocumentMouseDown( event ) {
    event.preventDefault();
    raycaster.setFromCamera( mouse, camera );
    var intersects = raycaster.intersectObjects( subcomponents );
    if ( intersects.length > 0 ) {
	control.attach(intersects[0].object);
	scene.add(control);
	comp.subcomponents.open();
	if(SELECTED != undefined)
		comp.subcomponents[SELECTED].close();
	comp.subcomponents[intersects[0].object.name].open();
	var string = "models/" + intersects[0].object.className + "/graph-print.svg";
	document.getElementById('svg-view').src = string;
	SELECTED = intersects[0].object.name;
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
