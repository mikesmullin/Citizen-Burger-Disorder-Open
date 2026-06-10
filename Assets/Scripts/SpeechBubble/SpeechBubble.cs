using UnityEngine;
using System.Collections;
using UnityEngine.UI;

public class SpeechBubble : MonoBehaviour {

	public bool appearOnlyWhenPlayerIsNear = false;
	float distFromPlayerToAppear = 20f;

	public GameObject myNPC;
	public Image myImage;
	string myImageName = "";
	Vector3 objectOrbitPosition = Vector3.zero;

	public Sprite NumberStand;

	float sinValue = 1;
	float ySpeed = 1.6f;
	float yScale = 0.05f;
	float yOffset = 2.15f;

	float cosValue = 1;
	float xSpeed = -0.2f;
	float xScale = 0.3f;
	public float xOffset = 0f;

	void Awake()
	{
		if(myImage==null)
		{
			myImage = transform.FindChild("Image").GetComponent<Image>();
		}
	}

	// Use this for initialization
	void Start ()
	{
		PositionAroundNPC();
	}
	
	// Update is called once per frame
	void LateUpdate ()
	{
		if(appearOnlyWhenPlayerIsNear)
		{
			float distFromPlayer = (transform.position - FirstPersonControl.localPlayer.transform.position).magnitude;

			if(distFromPlayer < distFromPlayerToAppear)
			{
				if(!GetComponent<Canvas>().enabled)
				{
					PositionAroundNPC();
				}

				GetComponent<Canvas>().enabled = true;
			}
			else
			{
				GetComponent<Canvas>().enabled = false;
			}
		}

		if(myNPC!=null)
		{
			objectOrbitPosition = myNPC.transform.position + (myNPC.transform.up *  yOffset);
			if(xOffset!=0)
			{
				objectOrbitPosition += Camera.main.transform.right * xOffset;

			}

			float newY = (Mathf.Sin(sinValue) * yScale) + yOffset;
			sinValue += ySpeed * Time.deltaTime;

			float newX = (Mathf.Cos(cosValue) * xScale) + xOffset;
			cosValue += xSpeed * Time.deltaTime;

			transform.position = Vector3.Lerp(transform.position, new Vector3(objectOrbitPosition.x, objectOrbitPosition.y + newY, objectOrbitPosition.z), ySpeed * Time.deltaTime);
			transform.rotation = Quaternion.Lerp(transform.rotation, Quaternion.LookRotation((transform.position - Camera.main.transform.position).normalized), 15f * Time.deltaTime);
		}
	}

	[RPC]
	void SyncSpeechBubble(string imageName, int xOff, NetworkViewID npcID, NetworkViewID speechID)
	{
		try
		{
			SpeechBubble newSB = NetworkView.Find(speechID).transform.GetComponent<SpeechBubble>();
			GameObject NPC = NetworkView.Find(npcID).gameObject;

			newSB.UpdateImage(imageName);

			newSB.myNPC = NPC;
			xOffset = xOff;

			PositionAroundNPC();

		}
		catch(UnityException e)
		{
			print ("Couldn't find this npc!");
		}
	}

	public void SetIndex(int index)
	{
		if(index%2==0) xOffset = 2 * index;
		else xOffset = -2 * index;

		PositionAroundNPC();
	}

	public void UpdateImageToFood(string nameOfFood)
	{
//		print ("Seaching for " + nameOfFood);

		myImage.sprite = Menu.GetFoodSprite(nameOfFood);
		myImageName = nameOfFood;
	}

	public void UpdateImage(string s)
	{
		switch(s)
		{
		case "NumberStand":
			UpdateImage(NumberStand);
			break;
		default:
			UpdateImageToFood(s);
			break;
		}

	}
	
	public void UpdateImage(Sprite s)
	{
		myImage.sprite = s;
		myImageName = s.name;
	}

	void PositionAroundNPC()
	{
		objectOrbitPosition = myNPC.transform.position + (myNPC.transform.up *  yOffset);
		transform.position = objectOrbitPosition;
	}
}
