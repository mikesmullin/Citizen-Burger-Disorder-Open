using UnityEngine;
using System.Collections;
using System.Collections.Generic;

public class Chat : MonoBehaviour {
	
	bool typing = false;

	List<string> chat = new List<string>();
	List<string> chatUsers = new List<string>();
	List<bool> chatEditingLine = new List<bool>();
	List<float> chatTimestamp = new List<float>();

	string newChatInput = "";
	string currentChatLine = "";

	float inputStartTime = 0;
	float inputStartDelay = 0.2f;
	float sentFrame = 0;
	float receivedFrame = 0;

	float lastChatInput = 0;
	float chatFadeStartTime = 5;
	float chatFadeDuration = 2;

	menu mainMenu;

	// Use this for initialization
	void Start ()
	{
		mainMenu = GetComponent<menu>();
	}

	[RPC]
	void SendNewChatInput(string username, string chatInput, bool endLine)
	{
		int lineIndex = -1;

		if(chatUsers.Count==0) lineIndex = -1;
		else if(chatUsers.Count>0) lineIndex = chatUsers.LastIndexOf(username);
		else if(chatUsers[chatUsers.Count-1]!=username) lineIndex = -1;

		if(lineIndex == -1 || chatEditingLine[lineIndex] == false)
		{
			chatUsers.Add(username);
			chat.Add(chatInput);
			chatEditingLine.Add(true);
			chatTimestamp.Add(Time.time);
		}
		else
		{
			chat[lineIndex] += " " + chatInput;
			chatEditingLine[lineIndex] = endLine;
			chatTimestamp[lineIndex] = Time.time;
		}

		lastChatInput = Time.time;

		//chat += "\n" + username + ": " + chatInput;
	}
	
	// Update is called once per frame
	void LateUpdate ()
	{
		if(!mainMenu.enabled) //Network.peerType != NetworkPeerType.Disconnected &&
		{
			// Send chat message
			if(sentFrame == Time.frameCount && receivedFrame != Time.frameCount && newChatInput!="")
			{
				lastChatInput = Time.time;
				receivedFrame = Time.frameCount;

				GetComponent<NetworkView>().RPC("SendNewChatInput", RPCMode.All, PlayerPrefs.GetString("Username"), newChatInput, typing);
				newChatInput = "";
			}
		}
	}

	void OnGUI ()
	{
		Event e = Event.current;

		if(!mainMenu.enabled)
		{
			if(typing)
			{
				// pressed enter
				if(inputStartTime + inputStartDelay < Time.time && e.type == EventType.keyDown && Event.current.character == "\n"[0])
				{
					if(currentChatLine!="")
					{
						int lastIndex = currentChatLine.LastIndexOf(" ");
						string newWord = currentChatLine.Substring(0, currentChatLine.Length);
						int startIndex = Mathf.Max(0, newWord.LastIndexOf(" "));
						
						if(startIndex>0) startIndex++;
						newWord = newWord.Substring(startIndex, newWord.Length - startIndex);
						newChatInput = newWord;
						if(newChatInput.Length==0) newChatInput = " ";
						sentFrame = Time.frameCount;
					}
					
					currentChatLine = "";
					typing = false;
				}

				// pressed spacebar
				if (currentChatLine!="" && currentChatLine.Substring(currentChatLine.Length-1)!=" " && sentFrame + 5 < Time.frameCount && (e.keyCode == KeyCode.Space))
				{
					int lastIndex = currentChatLine.LastIndexOf(" ");
					string newWord = currentChatLine.Substring(0, currentChatLine.Length);
					int startIndex = Mathf.Max(0, newWord.LastIndexOf(" "));

					if(startIndex>0) startIndex++;
					newWord = newWord.Substring(startIndex, newWord.Length - startIndex);
					newChatInput = newWord;
					sentFrame = Time.frameCount;
				}
				
				GUI.skin.textField.alignment = TextAnchor.MiddleLeft;
				GUI.skin.textField.fontSize = 28;
				GUI.SetNextControlName("ChatLine");
				currentChatLine = GUI.TextField(new Rect(20, Screen.height - 90, Screen.width - 40, 80), ""+currentChatLine);
				GUI.FocusControl ("ChatLine");
			}
			else
			{
				sentFrame = Time.frameCount;

				if(e.type == EventType.KeyDown && Event.current.character == "\n"[0])
				{
					currentChatLine = "";
					newChatInput = "";

					typing = true;
					inputStartTime = Time.time;
				}
			}
		}

		GUI.skin.label.fontSize = 20;

		string chatDisplay = "";

		if(chatUsers.Count>0)
		{
			int startI = Mathf.Min(chatUsers.Count, 6);

			for(int i=startI; i>0; i--)
			{
				if(i>chatUsers.Count) break;

				chatDisplay += "\n" + chatUsers[chatUsers.Count - i] + ": " + chat[chat.Count - i];
			}
		}

		GUI.skin.label.alignment = TextAnchor.LowerLeft;

		if(typing)
		{
			GUI.skin.label.normal.textColor = Color.black;
			GUI.Label(new Rect(19, Screen.height - 400 , 550, 300), ""+chatDisplay);
			GUI.skin.label.normal.textColor = Color.white;
			GUI.Label(new Rect(20, Screen.height - 400 - 2, 550, 300), ""+chatDisplay);
		}
		else
		{
			Color blackTextColor = Color.black;
			Color whiteTextColor = Color.white;

			if(Time.time > lastChatInput + chatFadeStartTime)
			{
				blackTextColor = Color.Lerp(Color.black, new Color(0,0,0,0), ( (Time.time - lastChatInput - chatFadeStartTime) / (chatFadeStartTime + chatFadeDuration - chatFadeStartTime) ));
				whiteTextColor = Color.Lerp(Color.white, new Color(0,0,0,0), ( (Time.time - lastChatInput - chatFadeStartTime) / (chatFadeStartTime + chatFadeDuration - chatFadeStartTime) ));

			}

			GUI.skin.label.normal.textColor = blackTextColor;
			GUI.Label(new Rect(19, Screen.height - 300, 550, 300), ""+chatDisplay);
			GUI.skin.label.normal.textColor = whiteTextColor;
			GUI.Label(new Rect(20, Screen.height - 300 - 2, 550, 300), ""+chatDisplay);
		}

		GUI.skin.label.alignment = TextAnchor.MiddleLeft;
	}
}
