/**
 * Create new item:
 * 1 - Add name to Items array
 * 2 - Create a FoodType array with ingrediants
 * 3 - Add a case statement in CompareAgainstFood to loop through the FoodType array
 */

using UnityEngine;
using System.Collections;
using System.Collections.Generic;

public static class Menu {
	
	// Patty, cheese, lettuce, bun
	public static Food.FoodType[] Citizen = new Food.FoodType[] { Food.FoodType.patty, Food.FoodType.cheese, Food.FoodType.lettuce, Food.FoodType.topBun };
	// Patty, cheese, bun, patty, cheese, lettuce, bun
	public static Food.FoodType[] Family = new Food.FoodType[] { Food.FoodType.patty, Food.FoodType.cheese, Food.FoodType.bun, Food.FoodType.patty, Food.FoodType.cheese, Food.FoodType.lettuce, Food.FoodType.topBun };
	// Cheese, patty, cheese, bun
	public static Food.FoodType[] Worker = new Food.FoodType[] { Food.FoodType.patty, Food.FoodType.cheese, Food.FoodType.patty, Food.FoodType.cheese, Food.FoodType.topBun };
	// Cheese, patty, lettuce, 2xTomatoes
	public static Food.FoodType[] President = new Food.FoodType[] { Food.FoodType.cheese, Food.FoodType.patty, Food.FoodType.lettuce, Food.FoodType.tomato, Food.FoodType.tomato, Food.FoodType.topBun };
	// Patty, Lettuce, 2xTomatoes, 2xBacon
	public static Food.FoodType[] Mayor = new Food.FoodType[] { Food.FoodType.patty, Food.FoodType.lettuce, Food.FoodType.tomato, Food.FoodType.tomato, Food.FoodType.bacon, Food.FoodType.bacon, Food.FoodType.topBun };
	// Patty, Cheese, Patty, 2xBacon
	public static Food.FoodType[] Boss = new Food.FoodType[] { Food.FoodType.patty, Food.FoodType.cheese, Food.FoodType.patty, Food.FoodType.bacon, Food.FoodType.bacon, Food.FoodType.topBun };
	
	public static Food.FoodType[][] Items = new Food.FoodType[][] { Citizen, Family, Worker, President, Mayor, Boss };
	public static string[] ItemNames = new string[] { "Citizen", "Family", "Worker", "President", "Mayor", "Boss" };
	
	public static Material GetFoodMaterial(string food)
	{
		return Resources.Load("UI/Materials/" + food) as Material;	
	}

	public static Sprite GetFoodSprite(string food)
	{
		Sprite s = Resources.Load<Sprite>("UI/" + food);
		return s;
	}

	public static float ScoreFood(string foodItem, Food foodToCompare)
	{
		float score = 0;
		float maxPotentialScore = 0;

		/* SCORE BREAKDOWN
		 * 
		 * patty   -  2.0 pts
		 * cheese  -  1.0 pts
		 * lettuce -  1.0 pts
		 * bacon   -  0.5 pts
		 * tomato  -  0.5 pts
		 * 
		 */

		// Food is a burger
		if(foodToCompare.transform.FindChild("burger-bottom"))
		{
			List<Food> foodOnBurger = new List<Food>(foodToCompare.transform.FindChild("burger-bottom").FindChild("triggerBunStack").GetComponent<BurgerStacking>().foodOnBurger);
			Food.FoodType[] goalFoods;

			// Max potential scores are presented as x + y + z for better understanding of the score makeup
			switch(foodItem)
			{
			default: // citizen is default
				maxPotentialScore = 2 + 1 + 1;
				goalFoods = new Food.FoodType[Citizen.Length-1];
				System.Array.Copy(Citizen, goalFoods, Citizen.Length-1);
				break;
			case "Citizen":
				maxPotentialScore = 2 + 1 + 1;
				goalFoods = new Food.FoodType[Citizen.Length-1];
				System.Array.Copy(Citizen, goalFoods, Citizen.Length-1);
				break;
			case "Family":
				maxPotentialScore = 2 + 1 + 1 + 2 + 1 + 1;
				goalFoods = new Food.FoodType[Family.Length-1];
				System.Array.Copy(Family, goalFoods, Family.Length-1);
				break;
			case "Worker":
				maxPotentialScore = 2 + 1 + 2 + 1;
				goalFoods = new Food.FoodType[Worker.Length-1];
				System.Array.Copy(Worker, goalFoods, Worker.Length-1);
				break;
			case "President":
				maxPotentialScore = 1 + 2 + 1 + 0.5f + 0.5f;
				goalFoods = new Food.FoodType[President.Length-1];
				System.Array.Copy(President, goalFoods, President.Length-1);
				break;
			case "Mayor":
				maxPotentialScore = 2 + 1 + 0.5f + 0.5f + 0.5f + 0.5f;
				goalFoods = new Food.FoodType[Mayor.Length-1];
				System.Array.Copy(Mayor, goalFoods, Mayor.Length-1);
				break;
			case "Boss":
				maxPotentialScore = 2 + 1 + 2 + 0.5f + 0.5f;
				goalFoods = new Food.FoodType[Boss.Length-1];
				System.Array.Copy(Boss, goalFoods, Boss.Length-1);
				break;
			}

			// Look through each item in the delivered burger
			for(int i = foodOnBurger.Count-1; i>=0; i--)
			{
				Food f = foodOnBurger[i];
				float multiply = 0; // change to -1 to penalise scores

				// Loop through the recipe and check off the current item
				for(int j = 0; j<goalFoods.Length; j++)
				{
					if(goalFoods[j] != null && f.type == goalFoods[j])
					{
						Debug.Log(f.type + "["+i+"] matches GF["+j+"]");

						multiply = 1;
						goalFoods.SetValue(null, j);

						// Add points based on food type - 'multiply' factors if the food exists in the recipe or not
						// lose points for being undercooked (cooked<1) or overcooked (overcooked>0)
						// Some foods will lose points for being cooked OR overcooked
						switch(f.type)
						{
						case Food.FoodType.bacon:
							score += 0.5f*multiply;

							if(f.cooked < 0.8f) score *= f.cooked;
							score *= (1-f.overcooked);
							break;
						case Food.FoodType.tomato:
							score += 0.5f*multiply;

							score *= 1-f.cooked;
							score *= 1-f.overcooked;
							break;
						case Food.FoodType.patty:
							score += 2*multiply;

							if(f.cooked < 0.8f) score *= f.cooked;
							score *= (1-f.overcooked);
							break;
						default:
							score += 1*multiply;

							score *= 1-f.cooked;
							score *= 1-f.overcooked;
							break;
						}

						foodOnBurger.Remove(f);

						break;
					}
				}
			}

			// Remove points for any remaining, therefor extra, food
			foreach(Food f in foodOnBurger)
			{
				// top buns are excluded from negative points
				if(f.type != Food.FoodType.topBun)
				{
					score -= 1;		
				}
			}
		}

		score = Mathf.Round(score);
		Debug.Log("This food scores " + score + " out of " + maxPotentialScore);

		return score;
	}
	
	public static bool CompareAgainstFood(string foodItem, Food foodToCompare)
	{
		bool r = true;

		switch(foodItem)
		{
		case "Citizen":
			// Make sure it's a burger
			if(foodToCompare.type == Food.FoodType.bun)
			{
				// Get list of food within the burger stack - bottom to top
				List<Food> foodInBurger = foodToCompare.transform.FindChild("burger-bottom").FindChild("triggerBunStack").GetComponent<BurgerStacking>().foodOnBurger;
				
				// Compare each item with what's in the menu
				if(foodInBurger.Count == Citizen.Length)
				{
					for(int i=0; i<foodInBurger.Count; i++)
					{
						// Exit the loop if something's not right
						if(foodInBurger[i].type != Citizen[i])
						{
							r = false;
							break;	
						}
					}
				}
				else r = false;
			}
			else r = false;
			
			break;
		case "Family":
			
			// Make sure it's a burger
			if(foodToCompare.type == Food.FoodType.bun)
			{
				// Get list of food within the burger stack - bottom to top
				List<Food> foodInBurger = foodToCompare.transform.FindChild("burger-bottom").FindChild("triggerBunStack").GetComponent<BurgerStacking>().foodOnBurger;
				
				// Compare each item with what's in the menu
				if(foodInBurger.Count == Family.Length)
				{
					for(int i=0; i<foodInBurger.Count; i++)
					{
						// Exit the loop if something's not right
						if(foodInBurger[i].type != Family[i])
						{
							r = false;
							break;	
						}
					}
				}
				else r = false;
			}
			else r = false;
			
			break;
		case "Worker":
			// Make sure it's a burger
			if(foodToCompare.type == Food.FoodType.bun)
			{
				// Get list of food within the burger stack - bottom to top
				List<Food> foodInBurger = foodToCompare.transform.FindChild("burger-bottom").FindChild("triggerBunStack").GetComponent<BurgerStacking>().foodOnBurger;
				
				// Compare each item with what's in the menu
				if(foodInBurger.Count == Worker.Length)
				{
					for(int i=0; i<foodInBurger.Count; i++)
					{
						// Exit the loop if something's not right
						if(foodInBurger[i].type != Worker[i])
						{
							r = false;
							break;	
						}
					}
				}
				else r = false;
			}
			else r = false;
			
			break;
		case "President":
			
			// Make sure it's a burger
			if(foodToCompare.type == Food.FoodType.bun)
			{
				// Get list of food within the burger stack - bottom to top
				List<Food> foodInBurger = foodToCompare.transform.FindChild("burger-bottom").FindChild("triggerBunStack").GetComponent<BurgerStacking>().foodOnBurger;
				
				// Compare each item with what's in the menu
				if(foodInBurger.Count == President.Length)
				{
					for(int i=0; i<foodInBurger.Count; i++)
					{
						// Exit the loop if something's not right
						if(foodInBurger[i].type != President[i])
						{
							r = false;
							break;	
						}
					}
				}
				else r = false;
			}
			else r = false;
			
			break;
		case "Mayor":
			
			// Make sure it's a burger
			if(foodToCompare.type == Food.FoodType.bun)
			{
				// Get list of food within the burger stack - bottom to top
				List<Food> foodInBurger = foodToCompare.transform.FindChild("burger-bottom").FindChild("triggerBunStack").GetComponent<BurgerStacking>().foodOnBurger;
				
				// Compare each item with what's in the menu
				if(foodInBurger.Count == Mayor.Length)
				{
					for(int i=0; i<foodInBurger.Count; i++)
					{
						// Exit the loop if something's not right
						if(foodInBurger[i].type != Mayor[i])
						{
							r = false;
							break;	
						}
					}
				}
				else r = false;
			}
			else r = false;
			
			break;
		case "Boss":
			
			// Make sure it's a burger
			if(foodToCompare.type == Food.FoodType.bun)
			{
				// Get list of food within the burger stack - bottom to top
				List<Food> foodInBurger = foodToCompare.transform.FindChild("burger-bottom").FindChild("triggerBunStack").GetComponent<BurgerStacking>().foodOnBurger;
				
				// Compare each item with what's in the menu
				if(foodInBurger.Count == Boss.Length)
				{
					for(int i=0; i<foodInBurger.Count; i++)
					{
						// Exit the loop if something's not right
						if(foodInBurger[i].type != Boss[i])
						{
							r = false;
							break;	
						}
					}
				}
				else r = false;
			}
			else r = false;
			
			break;
		}
		
		return r;
	}
}
