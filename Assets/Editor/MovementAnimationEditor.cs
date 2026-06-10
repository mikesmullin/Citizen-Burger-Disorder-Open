using UnityEngine;
using System.Collections;
using UnityEditor;

[CustomEditor(typeof(MovementAnimation))]
public class MovementAnimationEditor : Editor {
	
	enum currentState
	{
		normal,
		createEnd,
		setSpeed,
		editWhich,
		editStart,
		editEnd,
		moveTo,
		clearConfirm,
		clearLastConfirm
	}
	currentState state = currentState.normal;
	
	float speed = 0;
	int edit = 0;
	
	public override void OnInspectorGUI ()
	{
		MovementAnimation uiTarget = (MovementAnimation)target;
		
		// MAIN
		if(state == currentState.normal)
		{
			if(GUILayout.Button("Set Start"))
			{
				uiTarget.saveNewStart();
				state = currentState.createEnd;
			}
			
			if(GUILayout.Button("Edit"))
			{
				state = currentState.editWhich;
			}
			
			if(GUILayout.Button("MoveTo"))
			{
				state = currentState.moveTo;
			}
			
			GUILayout.Label("");
			GUILayout.Label("");
			GUILayout.Label("");
			
			if(GUILayout.Button("Clear Last"))
			{
				state = currentState.clearLastConfirm;
			}
			
			if(GUILayout.Button("Clear All"))
			{
				state = currentState.clearConfirm;
			}
		}
		else if(state == currentState.moveTo)
		{
			GUILayout.Label("Move to which position?");
			
			for(int i=0; i<uiTarget.startPositions.Count; i++)
			{
				if(GUILayout.Button(i + " Start"))
				{
					uiTarget.transform.position = uiTarget.startPositions[i];
					uiTarget.transform.rotation = uiTarget.startRotation[i];
					state = currentState.normal;
				}	
				if(GUILayout.Button(i + " End"))
				{
					uiTarget.transform.position = uiTarget.endPositions[i];
					uiTarget.transform.rotation = uiTarget.endRotation[i];
					state = currentState.normal;
				}
				GUILayout.Label("");
				
			}
			
			GUILayout.Label("");
			GUILayout.Label("");
			
			if(GUILayout.Button("Cancel"))
			{
				state = currentState.normal;
			}
		}
		else if(state == currentState.editWhich)
		{
			GUILayout.Label("Pick an index to edit:");
			
			for(int i=0; i<uiTarget.startPositions.Count; i++)
			{
				if(GUILayout.Button("[ " + i + " ]"))
				{
					edit = i;
					state = currentState.editStart;
				}	
			}
			
			GUILayout.Label("");
			
			if(GUILayout.Button("Cancel"))
			{
				state = currentState.normal;
			}
		}
		else if(state == currentState.editStart)
		{
			if(GUILayout.Button("Change Start"))
			{
				uiTarget.editStart(edit);
				state = currentState.editEnd;
			}
			if(GUILayout.Button("Skip to Editing End"))
			{
				state = currentState.editEnd;
			}
			GUILayout.Label("");
			if(GUILayout.Button("Delete"))
			{
				uiTarget.ClearSpecific(edit);
				state = currentState.normal;
			}
		}
		else if(state == currentState.editEnd)
		{
			if(GUILayout.Button("Change End"))
			{
				uiTarget.editEnd(edit);
				state = currentState.normal;
			}
			if(GUILayout.Button("Don't change end"))
			{
				state = currentState.normal;
			}
		}
		else if(state == currentState.createEnd)
		{
			if(GUILayout.Button("Set End Position"))
			{
				uiTarget.saveNewEnd();
				state = currentState.setSpeed;
			}
		}
		else if(state == currentState.setSpeed)
		{			
			GUILayout.Label("Set Speed: " + speed);
			
			speed = GUILayout.HorizontalSlider(speed, 0, 10);
			speed *= 10;
			speed = Mathf.Round(speed)/10;

			if(GUILayout.Button("Lerp (Fade in)"))
			{
				uiTarget.setSpeed(speed);
				uiTarget.setLerp(true);
				state = currentState.normal;
			}
			if(GUILayout.Button("Linear (constant speed)"))
			{
				uiTarget.setSpeed(speed);
				uiTarget.setLerp(false);
				state = currentState.normal;
			}
		}
		else if(state == currentState.clearLastConfirm)
		{
			if(GUILayout.Button("cancel"))
			{
				state = currentState.normal;
			}
			
			if(GUILayout.Button("negative"))
			{
				state = currentState.normal;
			}
			
			if(GUILayout.Button("Clear the last one!"))
			{
				uiTarget.ClearLast();
				state = currentState.normal;
			}
		}
		// CLEAR ALL
		else if(state == currentState.clearConfirm)
		{
			if(GUILayout.Button("DUDE NO"))
			{
				state = currentState.normal;
			}
			
			if(GUILayout.Button("I NEVER ASKED FOR THIS"))
			{
				state = currentState.normal;
			}
			
			if(GUILayout.Button("Confirm!"))
			{
				uiTarget.ClearAll();
				state = currentState.normal;
			}
		}
		
		GUILayout.Label("");
		GUILayout.Label("");
		GUILayout.Label("");

		GUILayout.FlexibleSpace();
		
		DrawDefaultInspector();
		
		
		
		
	}
}
