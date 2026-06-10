using UnityEngine;
using System.Collections;
using System.Collections.Generic;

public class MovementAnimation : MonoBehaviour {
	
	public List<Vector3> startPositions = new List<Vector3>();
	public List<Quaternion> startRotation = new List<Quaternion>();
	public List<Vector3> endPositions = new List<Vector3>();
	public List<Quaternion> endRotation = new List<Quaternion>();
	public List<float> speed = new List<float>();
	public List<bool> lerp = new List<bool>();
	
	public int currentIndex = 0;
	
	float startTime = 0;
	float distLength;

	void Start ()
	{
		RenderSettings.fogDensity = 0.07f;
		if(currentIndex == 2) RenderSettings.fogDensity = 0.3f;
		
		if(startPositions.Count == 0) enabled = false;
		else
		{
			transform.position = startPositions[currentIndex];
			//transform.rotation = startRotation[currentIndex];
			distLength = (transform.position - endPositions[currentIndex]).magnitude;
		}
	}
	
	// Update is called once per frame
	void Update ()
	{
		float distanceFromEnd = (transform.position - endPositions[currentIndex]).magnitude;
		float distCovered = (Time.time - startTime) * speed[currentIndex];
		float fracJourney = distCovered / distLength;

		if(lerp[currentIndex])
		{
			transform.position = Vector3.Lerp(transform.position, endPositions[currentIndex], speed[currentIndex] * Time.deltaTime);
		}
		else
		{
			transform.position = Vector3.Lerp(startPositions[currentIndex], endPositions[currentIndex], fracJourney);
		}
		
		transform.rotation = Quaternion.Lerp(startRotation[currentIndex], endRotation[currentIndex], fracJourney);
		
		if(currentIndex == 1 && (Time.time - startTime) > 6)
		{
			RenderSettings.fogDensity = Mathf.Lerp(RenderSettings.fogDensity, 0.07f, speed[currentIndex] * 4.6f * Time.deltaTime);
		}
		
		if(currentIndex == 2 && (Time.time - startTime) > 4)
		{
			RenderSettings.fogDensity = Mathf.Lerp(RenderSettings.fogDensity, 0.07f, speed[currentIndex] * 4.6f * Time.deltaTime);
		}
		
		if(currentIndex == 3 && (Time.time - startTime) > 20)
		{
			RenderSettings.fogDensity = Mathf.Lerp(RenderSettings.fogDensity, 0.06f, speed[currentIndex] * 4.6f * Time.deltaTime);
		}
		
		if(distanceFromEnd < 0.8f)
		{
			if(currentIndex != 3)
			{
				currentIndex = (currentIndex+1)	% startPositions.Count;
				startTime = Time.time;
				transform.position = startPositions[currentIndex];	
				transform.rotation = startRotation[currentIndex];
				distLength = (transform.position - endPositions[currentIndex]).magnitude;
				
				// fogs
				if(currentIndex == 0)
				{
					RenderSettings.fogDensity = 0.085f;
				}		
				else if(currentIndex == 1)
				{
					RenderSettings.fogDensity = 0.2f;
				}
				else if(currentIndex == 2)
				{
					RenderSettings.fogDensity = 0.3f;
				}
				else
				{
					RenderSettings.fogDensity = 0.07f;	
				}
				
				if(currentIndex == 3)
				{
					RenderSettings.fogDensity = 0.13f;	
					
					GameObject.Find("PlayerRender").GetComponent<Renderer>().enabled = false;	
				}
				else
				{
					GameObject.Find("PlayerRender").GetComponent<Renderer>().enabled = true;	
				}
			}
		}
	}
	
	public void editStart(int index)
	{
		startPositions[index] = transform.position;
		startRotation[index] = transform.rotation;
	}
	
	public void editEnd(int index)
	{
		endPositions[index] = transform.position;
		endRotation[index] = transform.rotation;
	}
	
	public void saveNewStart()
	{
		startPositions.Add(transform.position);
		startRotation.Add(transform.rotation);
	}
	
	public void saveNewEnd()
	{
		endPositions.Add(transform.position);
		endRotation.Add(transform.rotation);
	}
	
	public void setSpeed(float newSpeed)
	{
		speed.Add(newSpeed);	
	}
		
	public void setLerp(bool newLerp)
	{
		lerp.Add(newLerp);	
	}
	
	public void ClearSpecific(int index)
	{
		startPositions.RemoveAt(index);
		startRotation.RemoveAt(index);
		endPositions.RemoveAt(index);
		endRotation.RemoveAt(index);
		speed.RemoveAt(index);
	}
	
	public void ClearLast()
	{
		int last = startPositions.Count - 1;
		
		startPositions.RemoveAt(last);
		startRotation.RemoveAt(last);
		endPositions.RemoveAt(last);
		endRotation.RemoveAt(last);
		speed.RemoveAt(last);
	}
	
	public void ClearAll()
	{
		startPositions = new List<Vector3>();
		startRotation = new List<Quaternion>();
		endPositions = new List<Vector3>();
		endRotation = new List<Quaternion>();
		speed = new List<float>();
		lerp = new List<bool>();
	}
}
