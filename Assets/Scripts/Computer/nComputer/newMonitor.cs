using UnityEngine;
using System.Collections;
using System.Collections.Generic;
using UnityEngine.UI;

public class newMonitor : MonoBehaviour {

	public bool allowDebugKeyboardMovement = false;

	public List<newNavigationElement> CurrentSubMenus;
	public Transform currentMenuLevel;
	public Transform topMenuLevel;
	public newNavigationElement currentSelection;

	public Image OverlayImage;

	// moving menus
	public GameObject ObjectToSelect;
	public GameObject ObjectToDeselect;
	float verticalMoveDistance = 40;
	float horizontalMoveDistance = 60;
	float moveAnimationSpeed = 14;
	Vector3 deselectMoveDirection;

	bool movingSelection = false;

	List<newNavigationElement> AllNavElements;

	enum Direction
	{
		Up,
		Down,
		Left,
		Right
	}

	// Use this for initialization
	void Start ()
	{
		topMenuLevel = transform;

		Init();
	}

	void Init()
	{
		deselectMoveDirection = Vector3.zero;

		SetCurrentMenuLevel(transform);
		PopulateSubmenus();
		
		DisableAllSubMenus();
		ConfigCurrentSelected();
	}

	// Set parent of the current element
	void SetCurrentMenuLevel(Transform currentLvl)
	{
		currentMenuLevel = currentLvl;
	}

	void PopulateSubmenus()
	{
		CurrentSubMenus.Clear();
		
		foreach(Transform t in currentMenuLevel.transform)
		{
			if(t.GetComponent<newNavigationElement>())
				CurrentSubMenus.Add(t.GetComponent<newNavigationElement>());
		}
	}

	void PopulateSubmenus(newNavigationElement elementToReturnTo)
	{
		CurrentSubMenus.Clear();

		foreach(Transform t in currentMenuLevel.transform)
		{
			if(t.GetComponent<newNavigationElement>())
				CurrentSubMenus.Add(t.GetComponent<newNavigationElement>());
		}

		int indexOfCurrent = CurrentSubMenus.IndexOf(elementToReturnTo);

		int failSafe = 100;
		int failSafeCount = 0;

		while(indexOfCurrent>0 && failSafeCount < failSafe)
		{
			newNavigationElement temp = CurrentSubMenus[0];
			CurrentSubMenus.RemoveAt(0);
			CurrentSubMenus.Add(temp);

			indexOfCurrent = CurrentSubMenus.IndexOf(elementToReturnTo);
			failSafeCount++;
		}

		indexOfCurrent = CurrentSubMenus.IndexOf(elementToReturnTo);
	}

	public void ReceiveKeyPress(int keyIDPressed)
	{
		if(!movingSelection)
		{
			Direction dirPressed = (Direction)keyIDPressed;

			if(dirPressed == Direction.Left || dirPressed == Direction.Right)
			{

				if(currentSelection.MovesOnHorizontalInput)
				{
					MoveToMenuGroup(dirPressed);
				}
				else
				{
					int incVal = 0;

					switch(dirPressed)
					{
					case Direction.Left:
						incVal = -1;
						break;
					default:
						incVal = 1;
						break;
					}

					currentSelection.IncrementDisplayNumber(incVal);
				}
			}
			else
			{
				if(dirPressed == Direction.Up)
				{
					currentSelection.ConfirmThisElement();
				}

				MoveToMenuGroup(dirPressed);
			}
		}
	}

	// Update is called once per frame
	void Update ()
	{
		if(allowDebugKeyboardMovement)
		{
			if(Input.GetKeyDown(KeyCode.LeftBracket))
			{
				ReceiveKeyPress((int)Direction.Left);
			}
			if(Input.GetKeyDown(KeyCode.RightBracket))
			{
				ReceiveKeyPress((int)Direction.Right);
				//MoveToMenuGroup(Direction.Right);
			}
			if(Input.GetKeyDown(KeyCode.Equals))
			{
				ReceiveKeyPress((int)Direction.Up);
				//MoveToMenuGroup(Direction.Up);
			}
			if(Input.GetKeyDown(KeyCode.Quote))
			{
				ReceiveKeyPress((int)Direction.Down);
				//MoveToMenuGroup(Direction.Down);
			}
		}

		if(ObjectToSelect!=null)
		{
			movingSelection = true;

			float dist = (ObjectToDeselect.transform.localPosition - deselectMoveDirection).magnitude;


			if(dist>0.1f)
			{
				if(ObjectToDeselect.transform != ObjectToSelect.transform.parent)
				{
					ObjectToSelect.transform.localPosition = Vector3.Lerp(ObjectToSelect.transform.localPosition, Vector3.zero, moveAnimationSpeed * Time.deltaTime);
				}
				
				if(ObjectToDeselect) ObjectToDeselect.transform.localPosition = Vector3.Lerp(ObjectToDeselect.transform.localPosition, deselectMoveDirection, moveAnimationSpeed * Time.deltaTime);
			}
			else
			{
				if(ObjectToDeselect.transform == ObjectToSelect.transform.parent)
				{
					ObjectToSelect.transform.localPosition = Vector3.zero;
				}

				movingSelection = false;
				ObjectToSelect = null;
				ObjectToDeselect = null;

				DisableAllSubMenus(false);
			}
		}
	}

	void SetBackgroundToCurrent()
	{
		if(currentSelection.backgroundSpriteForCanvas) OverlayImage.sprite = currentSelection.backgroundSpriteForCanvas;
		else OverlayImage.sprite = null;
	}

	void ConfigCurrentSelected()
	{
		currentSelection = CurrentSubMenus[0];
		currentSelection.enabled = true;

		if(currentSelection.transform.parent != currentMenuLevel)
		{
			currentMenuLevel = currentSelection.transform.parent;
		}

		SetBackgroundToCurrent();
	}

	void ConfigCurrentSelected(Vector3 position)
	{
		currentSelection = CurrentSubMenus[0];
		currentSelection.enabled = true;
		currentSelection.transform.localPosition = position;

		SetBackgroundToCurrent();
	}

	void ConfigCurrentSelected(newNavigationElement elementToSelect, Vector3 position)
	{
		currentSelection = elementToSelect;
		currentSelection.enabled = true;

		currentSelection.transform.localPosition = position;

		SetBackgroundToCurrent();
	}
	
	void DisableAllSubMenus(bool includingCurrent=true)
	{
		if(AllNavElements == null)
		{
			AllNavElements = new List<newNavigationElement>(topMenuLevel.GetComponentsInChildren<newNavigationElement>());
		}

		foreach(newNavigationElement nav in AllNavElements)
		{
			if(!(!includingCurrent && currentSelection == nav))
			{
				nav.enabled = false;
				nav.transform.localPosition = Vector3.zero;
			}
		}
	}

	void MoveToMenuGroup(Direction dir)
	{
		newNavigationElement elementToMoveInList;

		if(dir == Direction.Right)
		{
			if(CurrentSubMenus.Count>1)
			{
				if(ObjectToDeselect) ObjectToDeselect.transform.localPosition = new Vector3(-horizontalMoveDistance * CurrentSubMenus.Count,0,0);
				elementToMoveInList = CurrentSubMenus[0];
				elementToMoveInList.transform.localPosition = Vector3.zero;

				CurrentSubMenus.RemoveAt(0);
				CurrentSubMenus.Add(elementToMoveInList);

				ObjectToSelect = CurrentSubMenus[0].gameObject;
				ObjectToDeselect = currentSelection.gameObject;
				
				deselectMoveDirection = new Vector3(-horizontalMoveDistance, 0, 0);
				ConfigCurrentSelected(-deselectMoveDirection);
			}
		}
		else if(dir == Direction.Left)
		{
			if(CurrentSubMenus.Count>1)
			{
				if(ObjectToDeselect) ObjectToDeselect.transform.localPosition = new Vector3(-horizontalMoveDistance * CurrentSubMenus.Count,0,0);
				elementToMoveInList = CurrentSubMenus[CurrentSubMenus.Count-1];
				elementToMoveInList.transform.localPosition = Vector3.zero;

				CurrentSubMenus.RemoveAt(CurrentSubMenus.Count-1);
				CurrentSubMenus.Insert(0, elementToMoveInList);

				ObjectToSelect = CurrentSubMenus[0].gameObject;
				ObjectToDeselect = currentSelection.gameObject;

				deselectMoveDirection = new Vector3(horizontalMoveDistance, 0, 0);
				ConfigCurrentSelected(-deselectMoveDirection);
			}
		}
		else if(dir == Direction.Up)
		{
			if(currentSelection.MoveToOnConfirm != null)
			{
				if(ObjectToDeselect) ObjectToDeselect.transform.localPosition = new Vector3(-horizontalMoveDistance * CurrentSubMenus.Count,0,0);

				elementToMoveInList = CurrentSubMenus[0];
				elementToMoveInList.transform.localPosition = Vector3.zero;

				SetCurrentMenuLevel(currentSelection.MoveToOnConfirm.transform.parent);
				PopulateSubmenus(currentSelection.MoveToOnConfirm);

				ObjectToSelect = currentSelection.MoveToOnConfirm.gameObject;
				ObjectToDeselect = currentSelection.gameObject;

				deselectMoveDirection = new Vector3(0, -verticalMoveDistance, 0);
				ConfigCurrentSelected(currentSelection.MoveToOnConfirm, -deselectMoveDirection);
			}
		}
		else if(dir == Direction.Down)
		{
			if(currentSelection.MoveToOnReturn != null)
			{
				if(ObjectToDeselect) ObjectToDeselect.transform.localPosition = new Vector3(-horizontalMoveDistance * CurrentSubMenus.Count,0,0);
				elementToMoveInList = CurrentSubMenus[0];
				elementToMoveInList.transform.localPosition = Vector3.zero;
				
				SetCurrentMenuLevel(currentSelection.MoveToOnReturn.transform.parent);
				PopulateSubmenus(currentSelection.MoveToOnReturn);
				
				ObjectToSelect = currentSelection.MoveToOnReturn.gameObject;
				ObjectToDeselect = currentSelection.gameObject;
				
				deselectMoveDirection = new Vector3(0, verticalMoveDistance, 0);
				ConfigCurrentSelected(currentSelection.MoveToOnReturn, -deselectMoveDirection);
			}
		}
	}
}
