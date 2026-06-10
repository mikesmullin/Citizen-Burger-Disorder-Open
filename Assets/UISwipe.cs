using UnityEngine;
using System.Collections;
using UnityEngine.EventSystems;

public class UISwipe : MonoBehaviour {

	public string currentSprite;
	Vector2 currentScreenPos;

	public bool selected=false;

	string releaseButton = "";
	float selectedFrame = 0;
	float releasedFrame = 0;
	Vector3 baseBeingHeldPosition = Vector3.zero;
	Transform beingHeldBy;

	public GameObject moveThis;

	bool moving = false;
	Vector3 movePos;
	float vertMoveDist = 8f;
	float horMoveDist = 12f;

	void Start()
	{
		currentScreenPos = Vector2.zero;
		currentSprite = "sBunBottom";
	}

	void SelectedByHand(Transform arm)
	{
		if(!selected)
		{
			selected = true;
			selectedFrame = Time.frameCount;
			beingHeldBy = arm;
			baseBeingHeldPosition = arm.transform.position;
		}
	}

	/* 1 = left, 2 = right */
	void SetReleaseButton(int release=0)
	{
		switch(release)
		{
		case 1:
			releaseButton = "Fire1";
			break;
		case 2:
			releaseButton = "Fire2";
			break;
		default:
			releaseButton = "Fire1";
			break;
		}
	}

	void UnselectByHand()
	{
		print ("---- let go! ----");

		Swipe();

		selected = false;
		selectedFrame = 0;
		beingHeldBy = null;
		releaseButton = "";
		baseBeingHeldPosition = Vector3.zero;
	}

	public void Swipe()
	{
		Vector3 dist = beingHeldBy.transform.position - baseBeingHeldPosition;
		Vector3 direction = transform.InverseTransformDirection((dist).normalized);


		print (dist.magnitude);
		print (direction);

		if(Mathf.Abs(direction.y) > 0.2f)
		{
			if(direction.y > 0.2f)
			{
				print ("Up!");
				currentScreenPos.y ++;
				movePos = moveThis.transform.position + moveThis.transform.up * vertMoveDist;
			}
			if(direction.y < -0.2f)
			{
				print ("Down!");
				currentScreenPos.y --;
				movePos = moveThis.transform.position - moveThis.transform.up * vertMoveDist;
			}
		}
		else if(dist.magnitude>0.2)
		{
			if(direction.x > 0.15f)
			{
				print ("Right!");
				currentScreenPos.x ++;
				movePos = moveThis.transform.position + moveThis.transform.right * horMoveDist;
			}
			if(direction.x < -0.4f)
			{
				print ("Left!");
				currentScreenPos.x --;
				movePos = moveThis.transform.position - moveThis.transform.right * horMoveDist;
			}
		}

		if(currentScreenPos == new Vector2(0,0)) currentSprite = "sBunBottom";
		else if(currentScreenPos == new Vector2(0,-1)) currentSprite = "sPatty";
		else if(currentScreenPos == new Vector2(1,-1)) currentSprite = "sCheese";
		else if(currentScreenPos == new Vector2(-1,-1)) currentSprite = "sLettuce";
		else if(currentScreenPos == new Vector2(0,-2)) currentSprite = "sBunTop";
		else currentSprite = "sBunBottom";

		if(movePos != Vector3.zero)
		{
			Debug.DrawLine(transform.position, movePos, Color.red, 2f);

			moving = true;
		}
		else
		{
			print ("Select current!");
		}
	}

	// Update is called once per frame
	void Update () {
		BaseEventData pointer = new PointerEventData(EventSystem.current);

		// HOLDING
		if(selected)
		{
			// LET GO
			if(Input.GetButtonUp(releaseButton))
			{
				releasedFrame = Time.frameCount;
				ExecuteEvents.Execute(gameObject, pointer, ExecuteEvents.pointerUpHandler);
				UnselectByHand();
				return;
			}

			if(selectedFrame + 1 == Time.frameCount)
			{
				ExecuteEvents.Execute(gameObject, pointer, ExecuteEvents.pointerEnterHandler);

			}
			if(selectedFrame + 2 == Time.frameCount)
			{
				ExecuteEvents.Execute(gameObject, pointer, ExecuteEvents.pointerDownHandler);
			}
		}
		else
		{
			if(Time.frameCount > 10 && releasedFrame + 1 == Time.frameCount)
			{
				ExecuteEvents.Execute(gameObject, pointer, ExecuteEvents.pointerExitHandler);
			}
		}

		if(moving)
		{
			moveThis.transform.position = Vector3.Lerp(moveThis.transform.position, movePos, 10f * Time.deltaTime);

			if((moveThis.transform.position - movePos).magnitude < 0.1f) moving = false;
		}
	}
}
