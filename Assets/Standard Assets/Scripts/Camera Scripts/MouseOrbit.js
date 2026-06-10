var target : Transform;
var distance = 10.0;

var xSpeed = 250.0;
var ySpeed = 120.0;
var sensitivity = 10;
var maxSensitivity = 30;
var minSensitivity = 5;

var yMinLimit = -20;
var yMaxLimit = 80;

private var x = 0.0;
private var y = 0.0;

@script AddComponentMenu("Camera-Control/Mouse Orbit")

function Start () {

	enabled = false;

    var angles = transform.eulerAngles;
    x = angles.y;
    y = angles.x;

	// Make the rigid body not change rotation
   	if (GetComponent.<Rigidbody>())
		GetComponent.<Rigidbody>().freezeRotation = true;
}

function LateUpdate () {
    if (target) {
        x += Input.GetAxis("Mouse X") * xSpeed * 0.02;
        y -= Input.GetAxis("Mouse Y") * ySpeed * 0.02;
 		
 		y = ClampAngle(y, yMinLimit, yMaxLimit);
 		       
        var rotation = Quaternion.Euler(y, x, 0);
        var position = rotation * Vector3(0.0, 0.0, -distance) + target.position;
        
        transform.rotation = Quaternion.Lerp(this.transform.rotation, rotation, sensitivity * Time.deltaTime);
        
        var hit : RaycastHit;
        var movePos = Vector3.Lerp(this.transform.position, position, sensitivity * Time.deltaTime);
		var newPos : Vector3;
		
		if(Physics.Raycast(movePos, target.position - movePos, hit, (target.position - movePos).magnitude))
		{
			Debug.Log("Hit! " + Time.time);
			newPos = (hit.point - target.position) * 0.98 + target.position;
		}
		else
			newPos = movePos;
		
		transform.position = newPos;
    }
}

static function ClampAngle (angle : float, min : float, max : float) {
	if (angle < -360)
		angle += 360;
	if (angle > 360)
		angle -= 360;
	return Mathf.Clamp (angle, min, max);
}