// For an introduction to the Blank template, see the following documentation:
// http://go.microsoft.com/fwlink/?LinkId=232509
(function () {
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

    // defines a different color for each body
    var bodyColors = null;

    // total number of joints = 25
    var jointCount = null;

    // total number of bones = 24
    var boneCount = null;

    // handstate circle size
    var HANDSIZE = 20;

    // tracked bone line thickness
    var TRACKEDBONETHICKNESS = 4;

    // inferred bone line thickness
    var INFERREDBONETHICKNESS = 1;

    // thickness of joints
    var JOINTTHICKNESS = 3;

    // thickness of clipped edges
    var CLIPBOUNDSTHICKNESS = 5;

    // closed hand state color
    var HANDCLOSEDCOLOR = "red";

    // open hand state color
    var HANDOPENCOLOR = "green";

    // lasso hand state color
    var HANDLASSOCOLOR = "blue";

    // tracked joint color
    var TRACKEDJOINTCOLOR = "green";

    // inferred joint color
    var INFERREDJOINTCOLOR = "yellow";

    // C++ WinRT component
    var bodyImageProcessor = KinectImageProcessor.BodyHelper;




    ////////////////////// threejs 


    var container, stats;
    var camera, controls, scene, renderer;
    var objects = [], plane;

    var raycaster = new THREE.Raycaster();
    var mouse = new THREE.Vector2(),
    offset = new THREE.Vector3(),
    INTERSECTED, SELECTED;

    var sphere;

    function init() {

        container = document.createElement('div');
        document.body.appendChild(container);

        camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 10000);
        camera.position.z = 1000;

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
        light.position.set(0, 500, 2000);
        light.castShadow = true;

        light.shadowCameraNear = 200;
        light.shadowCameraFar = camera.far;
        light.shadowCameraFov = 50;

        light.shadowBias = -0.00022;
        light.shadowDarkness = 0.5;

        light.shadowMapWidth = 2048;
        light.shadowMapHeight = 2048;

        scene.add(light);

        var geometrySp = new THREE.SphereGeometry(70, 32, 32);
        var materialSp = new THREE.MeshBasicMaterial({ color: 0xaabb00 });
        sphere = new THREE.Mesh(geometrySp, materialSp);
        scene.add(sphere);


        var geometry = new THREE.BoxGeometry(40, 40, 40);

        for (var i = 0; i < 100; i++) {

            var object = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color: Math.random() * 0xffffff }));

            object.position.x = Math.random() * 1000 - 500;
            object.position.y = Math.random() * 600 - 300;
            object.position.z = Math.random() * 800 - 400;

            object.rotation.x = Math.random() * 2 * Math.PI;
            object.rotation.y = Math.random() * 2 * Math.PI;
            object.rotation.z = Math.random() * 2 * Math.PI;

            object.scale.x = Math.random() * 2 + 1;
            object.scale.y = Math.random() * 2 + 1;
            object.scale.z = Math.random() * 2 + 1;

            object.castShadow = true;
            object.receiveShadow = true;

            scene.add(object);

            objects.push(object);

        }

        plane = new THREE.Mesh(
            new THREE.PlaneBufferGeometry(2000, 2000, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0x001100, opacity: 0.25, transparent: true })
        );
        plane.visible = false;
        scene.add(plane);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setClearColor(0xf0f0f0);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.sortObjects = false;

        renderer.shadowMapEnabled = true;
        renderer.shadowMapType = THREE.PCFShadowMap;

        container.appendChild(renderer.domElement);

        var info = document.createElement('div');
        info.style.position = 'absolute';
        info.style.top = '10px';
        info.style.width = '100%';
        info.style.textAlign = 'center';
        info.innerHTML = '<a href="http://threejs.org" target="_blank">three.js</a> kinect-draggable webgl cubes';
        container.appendChild(info);

        stats = new Stats();
        stats.domElement.style.position = 'absolute';
        stats.domElement.style.top = '0px';
        container.appendChild(stats.domElement);

        renderer.domElement.addEventListener('mousemove', onDocumentMouseMove, false);
        renderer.domElement.addEventListener('mousedown', onDocumentMouseDown, false);
        renderer.domElement.addEventListener('mouseup', onDocumentMouseUp, false);

        //

        window.addEventListener('resize', onWindowResize, false);

    }

    function onWindowResize() {

        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();

        renderer.setSize(window.innerWidth, window.innerHeight);

    }

    function onDocumentMouseMove(event) {

        event.preventDefault();

        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        //console.log("event.clientX " + event.clientX);
        //console.log("event.clientY " + event.clientY);
        //console.log("mouse.x " + mouse.x);
        //console.log("mouse.y " + mouse.y);
        //

        raycaster.setFromCamera(mouse, camera);

        if (SELECTED) {

            var intersects = raycaster.intersectObject(plane);
            if (intersects.length > 0) {
                SELECTED.position.copy(intersects[0].point.sub(offset));

                if (event.clientZ) {
                    SELECTED.position.z = event.clientZ;
                }
            }
            return;

        }

        var intersects = raycaster.intersectObjects(objects);

        if (intersects.length > 0) {

            if (INTERSECTED != intersects[0].object) {

                if (INTERSECTED) INTERSECTED.material.color.setHex(INTERSECTED.currentHex);

                INTERSECTED = intersects[0].object;
                INTERSECTED.currentHex = INTERSECTED.material.color.getHex();

                plane.position.copy(INTERSECTED.position);
                plane.lookAt(camera.position);

            }

            container.style.cursor = 'pointer';

        } else {

            if (INTERSECTED) INTERSECTED.material.color.setHex(INTERSECTED.currentHex);

            INTERSECTED = null;

            container.style.cursor = 'auto';

        }

    }

    function onDocumentMouseDown(event) {

        event.preventDefault();

        var vector = new THREE.Vector3(mouse.x, mouse.y, 0.5).unproject(camera);

        var raycaster = new THREE.Raycaster(camera.position, vector.sub(camera.position).normalize());

        var intersects = raycaster.intersectObjects(objects);

        if (intersects.length > 0) {

            controls.enabled = false;

            SELECTED = intersects[0].object;

            var intersects = raycaster.intersectObject(plane);
            if (intersects.length > 0) {
                offset.copy(intersects[0].point).sub(plane.position);
            }

            container.style.cursor = 'move';

        }

    }

    function onDocumentMouseUp(event) {

        event.preventDefault();

        controls.enabled = true;

        if (INTERSECTED) {

            plane.position.copy(INTERSECTED.position);

            SELECTED = null;

        }

        container.style.cursor = 'auto';

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




    // Create array of bones
    var populateBones = function () {
        var bones = new Array();

        // torso
        bones.push({ jointStart: kinect.JointType.head, jointEnd: kinect.JointType.neck });
        bones.push({ jointStart: kinect.JointType.neck, jointEnd: kinect.JointType.spineShoulder });
        bones.push({ jointStart: kinect.JointType.spineShoulder, jointEnd: kinect.JointType.spineMid });
        bones.push({ jointStart: kinect.JointType.spineMid, jointEnd: kinect.JointType.spineBase });
        bones.push({ jointStart: kinect.JointType.spineShoulder, jointEnd: kinect.JointType.shoulderRight });
        bones.push({ jointStart: kinect.JointType.spineShoulder, jointEnd: kinect.JointType.shoulderLeft });
        bones.push({ jointStart: kinect.JointType.spineBase, jointEnd: kinect.JointType.hipRight });
        bones.push({ jointStart: kinect.JointType.spineBase, jointEnd: kinect.JointType.hipLeft });

        // right arm
        bones.push({ jointStart: kinect.JointType.shoulderRight, jointEnd: kinect.JointType.elbowRight });
        bones.push({ jointStart: kinect.JointType.elbowRight, jointEnd: kinect.JointType.wristRight });
        bones.push({ jointStart: kinect.JointType.wristRight, jointEnd: kinect.JointType.handRight });
        bones.push({ jointStart: kinect.JointType.handRight, jointEnd: kinect.JointType.handTipRight });
        bones.push({ jointStart: kinect.JointType.wristRight, jointEnd: kinect.JointType.thumbRight });

        // left arm
        bones.push({ jointStart: kinect.JointType.shoulderLeft, jointEnd: kinect.JointType.elbowLeft });
        bones.push({ jointStart: kinect.JointType.elbowLeft, jointEnd: kinect.JointType.wristLeft });
        bones.push({ jointStart: kinect.JointType.wristLeft, jointEnd: kinect.JointType.handLeft });
        bones.push({ jointStart: kinect.JointType.handLeft, jointEnd: kinect.JointType.handTipLeft });
        bones.push({ jointStart: kinect.JointType.wristLeft, jointEnd: kinect.JointType.thumbLeft });

        // right leg
        bones.push({ jointStart: kinect.JointType.hipRight, jointEnd: kinect.JointType.kneeRight });
        bones.push({ jointStart: kinect.JointType.kneeRight, jointEnd: kinect.JointType.ankleRight });
        bones.push({ jointStart: kinect.JointType.ankleRight, jointEnd: kinect.JointType.footRight });

        // left leg
        bones.push({ jointStart: kinect.JointType.hipLeft, jointEnd: kinect.JointType.kneeLeft });
        bones.push({ jointStart: kinect.JointType.kneeLeft, jointEnd: kinect.JointType.ankleLeft });
        bones.push({ jointStart: kinect.JointType.ankleLeft, jointEnd: kinect.JointType.footLeft });

        return bones;
    }


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
                // create bones
                bones = populateBones();

                // set number of joints and bones
                jointCount = kinect.Body.jointCount;
                boneCount = bones.length;


                // open the sensor
                sensor.open();


                init();
                animate();
            } else {
                // TODO: This application has been reactivated from suspension.
                // Restore application state here.
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

            // iterate through each body
            for (var bodyIndex = 0; bodyIndex < bodies.length; ++bodyIndex) {
                var body = bodies[bodyIndex];
                var isTracking = false;

                // look for tracked bodies
                if (body.isTracked) {

                    if (trackingId == null) {
                        trackingId = body.trackingId;
                        // if (kinect != null && kinect.BodyFrameSource != null)
                        // {
                        //     kinect.BodyFrameSource.OverrideHandTracking(body.TrackingId);
                        // }
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

                        var xr = joints.lookup("11").position.x,
                        yr = joints.lookup("11").position.y,
                        zr = joints.lookup("11").position.z;
                        //console.log("xr " + xr + "yr " + yr + "zr " + zr);
                        xr = jointPoints[11].x;
                        yr = jointPoints[11].y

                        var xl = joints.lookup("7").position.x,
                        yl = joints.lookup("7").position.y,
                        zl = joints.lookup("7").position.z;

                        //console.log("xl " + xl + "yl " + yl + "zl " + zl);


                        var tempev = {
                            preventDefault: function () { },
                            //clientX: (xr + 1) * 800,
                            //clientY: (yr + 1) * 800,
                            clientX: (xr ) * 3,
                            clientY: (yr) * 2,
                           // clientZ: zr * 500
                            clientZ: zr * 300
                        };
                        //sphere.position.x = xr * 600;
                        //sphere.position.y = yr * 600;
                        sphere.position.x = xr * 2;
                        sphere.position.y = yr * -1;
                        sphere.position.z = zr * 200;



                        onDocumentMouseMove(tempev);

                        if (handRightState === 3 && handClosed === false) {
                            handClosed = true;
                            onDocumentMouseDown(tempev);
                        }
                        if (handRightState === 2 && handClosed === true) {
                            onDocumentMouseUp(tempev);
                            handClosed = false;
                        }

                        if (!handClosed) {
                            //camera.position.x = xl * 1000;
                            //camera.position.y = yl * 1000;
                            camera.position.x = xl * 500;
                            camera.position.y = yl * 500;
                            camera.position.z = zl * 700;
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
        if (depthFrameReader != null) {
            depthFrameReader.close();
        }

        if (sensor != null) {
            sensor.close();
        }
    }
    app.start();
})();
