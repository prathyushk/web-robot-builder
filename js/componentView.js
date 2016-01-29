var container
var camera, control, orbit, scene, renderer, stl_loader, gui, rightpanel, subprops, componentName;
var subcomponents = []
var componentLibrary = {};
var componentMenus = {};
      
var raycaster = new THREE.Raycaster();
var mouse = new THREE.Vector2(),
offset = new THREE.Vector3(),
INTERSECTED, SELECTED;

componentName = window.prompt("Name the component", "");
init();
render();

function UrlExists(url)
{
    var http = new XMLHttpRequest();
    http.open('HEAD', url, false);
    http.send();
    return http.status!=404;
}

function onLoadSTL(geometry){
    var n = window.prompt("Subcomponent Name","");
    var material = new THREE.MeshPhongMaterial( { color:0xffffff, shading: THREE.FlatShading } );
    var obj = new THREE.Mesh(geometry,material);
    obj.name = n;
    obj.className = compName;
    obj.interfaces = {};
    picoModule.getParameters(compName,function(response){
	console.log(response);
	obj.parameters = response;
    });
    for(i in componentLibrary[obj.className].interfaces){
	obj.interfaces[componentLibrary[obj.className].interfaces[i]] = "";
    }
    scene.add(obj);
    subcomponents.push(obj);
}


function getComponents()
{
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
    
    parameters = comp.addFolder("Parameters");
    interfaces = comp.addFolder("Interfaces");
    var component = {
	field:  "",
	parameterAdd:function(){
	    fieldName = window.prompt("Parameter name","");
	    parameters.add(component, 'field').name(fieldName);
	},
	interfaceAdd:function(){
	    fieldName = window.prompt("Interface name","");
	    interfaces.add(component, 'field').name(fieldName);
	}
    }
    parameters.add(component,'parameterAdd').name("Add Parameter");
    interfaces.add(component,'interfaceAdd').name("Add Interface");
}

function onKeyDown( event ) {
    switch ( event.keyCode ) {
    case 81: // Q
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
	rightpanel.removeFolder(SELECTED);
	subprops = rightpanel.addFolder(intersects[0].object.name);
	subprops.open();

	var constrs = subprops.addFolder("Constraints");
	for(i in intersects[0].object.parameters){
	    var f = constrs.addFolder(i);
	    var message = {
		value: "",
		function: ""
	    }
	    if(intersects[0].object.parameters[i] != null)
		message.value = intersects[0].object.parameters[i];
	    f.add(message,"value");
	    f.add(message,"function");
	}
	var ints = subprops.addFolder("Interfaces");
	for(i in intersects[0].object.interfaces){
	    var message = {
		text: intersects[0].object.interfaces[i]
	    }
	    ints.add(message,"text").name(i);
	}
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
