/// <reference path="../ts/winjs-2.0.d.ts" />
/// <reference path="../ts/three.d.ts" />
/// <reference path="../ts/three-trackballcontrols.d.ts" />
var KinectThreejs;
(function (KinectThreejs) {
    "use strict";
    var app = WinJS.Application;
    var activation = Windows.ApplicationModel.Activation;
    // array of all bodies
    var bodies = null;
    var app = WinJS.Application;
    var activation = Windows.ApplicationModel.Activation;
    var streams = Windows.Storage.Streams;
    var kinect = WindowsPreview.Kinect;
    // active Kinect sensor
    var sensor = null;
    // reader for body frames
    var bodyFrameReader = null;
    // array of all bodies
    var bodies = null;
    // tracked body id
    var trackingId = null;
    // array of all bones in a body
    // bone defined by two joints
    var bones = null;
    // total number of joints = 25
    var jointCount = null;
    // total number of bones = 24
    var boneCount = null;
    // C++ WinRT component
    var bodyImageProcessor = KinectImageProcessor.BodyHelper;
    ////////////////////// threejs
    var container, stats;
    var camera, controls, scene, renderer;
    var objects = [], plane;
    var raycaster = new THREE.Raycaster();
    var mouse = new THREE.Vector2(), offset = new THREE.Vector3(), INTERSECTED, SELECTED;
    var sphere;
    var groupCenter = new THREE.Vector3(0, 0, 1.1); // z is distance from sensor
    function init() {
        container = document.createElement('div');
        document.body.appendChild(container);
        // major settings coords in meter
        var fieldZize = 0.6;
        var oriBoxSize = 0.03; // will be random scaled x,y,z
        var sphereDia = 0.03;
        camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight); //, 1, 15
        camera.position.z = -1.0; // behind the sensor
        controls = new THREE.TrackballControls(camera);
        controls.rotateSpeed = 1.0;
        controls.zoomSpeed = 1.2;
        controls.panSpeed = 0.8;
        controls.noZoom = false;
        controls.noPan = false;
        controls.staticMoving = true;
        controls.dynamicDampingFactor = 0.3;
        scene = new THREE.Scene();
        scene.add(new THREE.AmbientLight(0x505050));
        var light = new THREE.SpotLight(0xffffff, 1.5);
        light.position.set(4.0, 4.0, -3.5);
        light.castShadow = true;
        light.shadowCameraNear = 50;
        light.shadowCameraFar = camera.far;
        light.shadowCameraFov = 50;
        light.shadowBias = -0.00022;
        light.shadowDarkness = 0.2;
        light.shadowMapWidth = 2048;
        light.shadowMapHeight = 2048;
        scene.add(light);
        // add the grab shere
        var geometrySp = new THREE.SphereGeometry(sphereDia, 0.1, 0.1);
        var materialSp = new THREE.MeshLambertMaterial({ color: 0xaabb00, opacity: 0.5, transparent: true, depthWrite: true });
        sphere = new THREE.Mesh(geometrySp, materialSp);
        scene.add(sphere);
        //scene.fog = new THREE.FogExp2(0xefd1b5, 0.5);
        // add the boxes
        var geometry = new THREE.BoxGeometry(oriBoxSize, oriBoxSize, oriBoxSize);
        for (var i = 0; i < 100; i++) {
            var object = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color: Math.random() * 0xffffff, opacity: 0.99, transparent: true, depthWrite: true }));
            // get some random size, position and rotation
            object.position.set((0.5 - Math.random()) * fieldZize + groupCenter.x, (0.5 - Math.random()) * fieldZize + groupCenter.y, (0.5 - Math.random()) * fieldZize + groupCenter.z);
            object.rotation.setFromVector3(new THREE.Vector3(Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI));
            object.scale.set(Math.random() * 2 + 1, Math.random() * 2 + 1, Math.random() * 2 + 1);
            object.castShadow = true;
            object.receiveShadow = true;
            scene.add(object);
            objects.push(object);
        }
        plane = new THREE.Mesh(new THREE.PlaneBufferGeometry(2000, 2000, 8, 8), new THREE.MeshBasicMaterial({ color: 0x001100, opacity: 0.25, transparent: true }));
        plane.visible = false;
        scene.add(plane);
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setClearColor(0xf0f0f0);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.sortObjects = false;
        //renderer.useFog = true;
        renderer.shadowMapEnabled = true;
        renderer.shadowMapType = THREE.PCFShadowMap;
        container.appendChild(renderer.domElement);
        var info = document.createElement('div');
        info.style.position = 'absolute';
        info.style.top = '60px';
        info.style.width = '100%';
        info.style.textAlign = 'center';
        info.innerHTML = '<a href="http://threejs.org" target="_blank">three.js</a> kinect-draggable webgl blocks. Tested with "Kinect for windows"-V2. Connect the Kinect and stand in front of it, your left hand will control the camera your right hand will control the 3D cursor (ball) and when you make a fist with your right hand, the cursor will allow you to grab the blocks and move them. ';
        container.appendChild(info);
        stats = new Stats();
        stats.domElement.style.position = 'absolute';
        stats.domElement.style.top = '0px';
        container.appendChild(stats.domElement);
        window.addEventListener('resize', onWindowResize, false);
    }
    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
    function animate() {
        requestAnimationFrame(animate);
        render();
        stats.update();
    }
    function render() {
        controls.update();
        renderer.render(scene, camera);
    }
    /////////////////// three js stuff
    app.onactivated = function (args) {
        if (args.detail.kind === activation.ActivationKind.launch) {
            if (args.detail.previousExecutionState !== activation.ApplicationExecutionState.terminated) {
                // get the kinectSensor object
                sensor = kinect.KinectSensor.getDefault();
                // add handler for sensor availability
                sensor.addEventListener("isavailablechanged", sensor_IsAvailableChanged);
                // open the reader for frames
                bodyFrameReader = sensor.bodyFrameSource.openReader();
                // wire handler for frame arrival
                bodyFrameReader.addEventListener("framearrived", reader_BodyFrameArrived);
                // get depth frame description
                var depthFrameDescription = sensor.depthFrameSource.frameDescription;
                // create bodies array
                bodies = new Array(sensor.bodyFrameSource.bodyCount);
                // set number of joints and bones
                jointCount = kinect.Body.jointCount;
                // open the sensor
                sensor.open();
                init();
                animate();
            }
            else {
            }
            args.setPromise(WinJS.UI.processAll());
        }
    };
    // Allocate space for joint locations
    var createJointPoints = function () {
        var jointPoints = [];
        for (var i = 0; i < jointCount; ++i) {
            jointPoints.push({ joint: 0, x: 0, y: 0 });
        }
        return jointPoints;
    };
    var handClosed = false;
    var capturedObject;
    // Handles the body frame data arriving from the sensor
    function reader_BodyFrameArrived(args) {
        // get body frame
        var bodyFrame = args.frameReference.acquireFrame();
        var dataReceived = false;
        if (bodyFrame != null) {
            // got a body, update body data
            bodyFrame.getAndRefreshBodyData(bodies);
            dataReceived = true;
            bodyFrame.close();
        }
        if (dataReceived) {
            for (var bodyIndex = 0; bodyIndex < bodies.length; ++bodyIndex) {
                var body = bodies[bodyIndex];
                var isTracking = false;
                // look for tracked bodies
                if (body.isTracked) {
                    if (trackingId == null) {
                        trackingId = body.trackingId;
                    }
                    if (trackingId != body.trackingId) {
                        continue;
                    }
                    isTracking == true;
                    // get joints collection
                    var joints = body.joints;
                    // allocate space for storing joint locations
                    var jointPoints = createJointPoints();
                    // call native component to map all joint locations to depth space
                    if (bodyImageProcessor.processJointLocations(joints, jointPoints)) {
                        //get right hand state
                        var handRightState = body.handRightState;
                        var xr = joints.lookup("11").position.x, yr = -1 * joints.lookup("11").position.y, zr = (-1 * joints.lookup("11").position.z) + (1.8 * groupCenter.z);
                        var xl = 0.4 + joints.lookup("7").position.x, yl = 0 + joints.lookup("7").position.y, zl = joints.lookup("7").position.z;
                        sphere.position.copy((new THREE.Vector3(xr, yr, zr)));
                        var firstObject = sphere;
                        var firstBB = new THREE.Box3().setFromObject(firstObject);
                        if (!capturedObject) {
                            //look if we have a collision
                            sphere.geometry.computeBoundingBox();
                            var sphBB = new THREE.BoundingBoxHelper(sphere);
                            var idx = 0;
                            for (idx = 0; idx < objects.length; idx++) {
                                var possibleGrabObject = objects[idx];
                                var secondBB = new THREE.Box3().setFromObject(possibleGrabObject);
                                var collision = firstBB.isIntersectionBox(secondBB);
                                if (collision) {
                                    if (handClosed) {
                                        capturedObject = possibleGrabObject;
                                        capturedObject.position.copy(sphere.position);
                                    }
                                    break;
                                }
                            }
                        }
                        else {
                            if (handClosed) {
                                capturedObject.position.copy(sphere.position);
                            }
                            else {
                                capturedObject = null;
                            }
                        }
                        if (handRightState === 3 && handClosed === false) {
                            handClosed = true;
                            sphere.material.setValues({ color: 0xff0000, opacity: 0.99, transparent: true, depthWrite: true }); //.transparent = true;
                        }
                        if (handRightState === 2 && handClosed === true) {
                            //  onDocumentMouseUp(tempev);
                            handClosed = false;
                            capturedObject = null; // let it go
                            sphere.material.setValues({ color: 0x00ff00, opacity: 0.3, transparent: true, depthWrite: true });
                        }
                        if (joints.first().hasCurrent) {
                            scene.setRotationFromQuaternion(new THREE.Quaternion(xl, yl, zl, 0.001));
                        }
                    }
                }
                if (!isTracking) {
                    trackingId = null;
                }
            }
        }
    }
    // Handler for sensor availability changes
    function sensor_IsAvailableChanged(args) {
        if (sensor.isAvailable) {
            console.log("status changed: Running");
        }
        else {
            console.log("status changed: Kinect not available!");
        }
    }
    app.oncheckpoint = function (args) {
        // TODO: This application is about to be suspended. Save any state
        // that needs to persist across suspensions here. You might use the
        // WinJS.Application.sessionState object, which is automatically
        // saved and restored across suspension. If you need to complete an
        // asynchronous operation before your application is suspended, call
        // args.setPromise().
    };
    app.onunload = function (args) {
        if (sensor != null) {
            sensor.close();
        }
    };
    app.start();
})(KinectThreejs || (KinectThreejs = {}));
//# sourceMappingURL=default.js.map