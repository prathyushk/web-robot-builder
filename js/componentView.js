var container
var camera, control, orbit, scene, renderer, stl_loader, gui, rightpanel, subprops, componentName;
var subcomponents = []
      
var raycaster = new THREE.Raycaster();
var mouse = new THREE.Vector2(),
offset = new THREE.Vector3(),
INTERSECTED, SELECTED;

componentName = window.prompt("Name the component", "");
init();
render();

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
    
    control = new THREE.TransformControls( camera, renderer.domElement );
    control.addEventListener( 'change', render );
    orbit = new THREE.OrbitControls( camera, renderer.domElement );
    loadGui();
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
    gui = new dat.GUI({ autoPlace: false, width: document.getElementById('left-panel').clientWidth });
    gui.domElement.removeChild(gui.__closeButton);
    document.getElementById('left-panel').appendChild(gui.domElement);
    gui.add(search, "Search");
    searchFilters = gui.addFolder("Filters");
    searchFilters.add(filters, "Mechanical");
    searchFilters.add(filters, "Electrical");
    searchFilters.add(filters, "Software");
    componentsFolder = gui.addFolder('Components');
    componentsFolder.open();
    var obj_load_button = {
	add:function(){
	    stl_loader.load('models/seg.stl',function(geometry){
		geometry.name = window.prompt("Subcomponent Name","");
		      material = new THREE.MeshBasicMaterial( { color: 0xff0000 } );
		var obj = new THREE.Mesh(geometry,material);
		scene.add(obj);
		subcomponents.push(obj);
	    });
	}
    }
    var finger_load_button = {
	add: function(){
	    stl_loader.load('models/finger.stl',function(geometry){
		geometry.name = window.prompt("Subcomponent Name","");
		material = new THREE.MeshBasicMaterial( { color: 0x0000ff } );
		var obj = new THREE.Mesh(geometry,material);
		scene.add(obj);
		subcomponents.push(obj);
	    });
	}
    }
    mechanicalComps = componentsFolder.addFolder("Mechanical");
    electricalComps = componentsFolder.addFolder("Electrical");
    softwareComps = componentsFolder.addFolder("Software")
    mechanicalComps.add(obj_load_button,"add").name("SegBase");
    mechanicalComps.add(finger_load_button,"add").name("Finger");
    rightpanel = new dat.GUI({ autoPlace: false, width: document.getElementById('right-panel').clientWidth });
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
	subprops = rightpanel.addFolder(intersects[0].object.geometry.name);
	subprops.open();
	subprops.addFolder("Constraints");
	subprops.addFolder("Interfaces");
	SELECTED = intersects[0].object.geometry.name;
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
