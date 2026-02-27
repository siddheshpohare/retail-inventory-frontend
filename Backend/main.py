import os
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from crewai import Agent, Task, Crew, Process
from langchain_community.llms import Ollama

# 1. Initialize FastAPI
app = FastAPI(title="Rossmann Inventory AI Backend")

# Enable CORS for React
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Initialize Ollama LLM (Local)
# Ensure you have run: ollama run llama3
llama3 = Ollama(model="llama3")

# 3. Define the Multi-Agent Crew
# Agent 1: The Rossmann Analyst (Forecasting)
analyst_agent = Agent(
    role='Rossmann Sales Analyst',
    goal='Analyze historical sales, store types, and assortment levels to predict demand',
    backstory="""You are an expert at analyzing Rossmann's 1,115 stores. 
    You understand that Store Type 'a' behaves differently than 'd' and that 
    Assortment 'c' (extended) requires higher stock buffers than 'a' (basic).""",
    llm=llama3,
    verbose=True
)

# Agent 2: The Pricing Strategist
pricing_agent = Agent(
    role='Retail Pricing Strategist',
    goal='Optimize prices based on store assortment and local competition',
    backstory="""You adjust prices dynamically. If a store has high competition 
    distance, you can maintain higher margins. For basic assortment stores, 
    you focus on high-volume, low-price strategies.""",
    llm=llama3,
    verbose=True
)

# Agent 3: The Inventory Manager
inventory_agent = Agent(
    role='Inventory & Logistics Manager',
    goal='Coordinate with the warehouse to ensure no stockouts in Rossmann stores',
    backstory="""You take the analyst's forecast and the pricing strategist's 
    plan to determine exactly how many units to ship from the central warehouse.""",
    llm=llama3,
    verbose=True
)

# 4. Data Models
class RossmannStoreData(BaseModel):
    store_id: int
    store_type: str  # a, b, c, d
    assortment: str  # a, b, c
    current_sales: float
    competition_dist: float
    stock_level: int

# 5. API Endpoints
@app.post("/process-store-optimization")
async def optimize_store(data: RossmannStoreData):
    try:
        # Task 1: Demand Forecast
        analysis_task = Task(
            description=f"""Analyze Store {data.store_id} (Type: {data.store_type}, Assortment: {data.assortment}). 
            Current stock is {data.stock_level}. Given the sales of {data.current_sales}, predict if 
            we need more stock.""",
            agent=analyst_agent,
            expected_output="A brief demand forecast report."
        )

        # Task 2: Pricing Strategy
        pricing_task = Task(
            description=f"""Given the competition distance of {data.competition_dist}m, 
            recommend a pricing adjustment for Assortment {data.assortment} to maximize profit.""",
            agent=pricing_agent,
            expected_output="A pricing recommendation (e.g., Increase 5% or Discount 10%)."
        )

        # Task 3: Inventory Action
        inventory_task = Task(
            description=f"Based on the analysis and pricing, confirm the restock quantity for Store {data.store_id}.",
            agent=inventory_agent,
            expected_output="Final restock quantity decision (number)."
        )

        # Execute the Crew
        rossmann_crew = Crew(
            agents=[analyst_agent, pricing_agent, inventory_agent],
            tasks=[analysis_task, pricing_task, inventory_task],
            process=Process.sequential
        )
        
        result = rossmann_crew.kickoff()
        
        return {
            "status": "success",
            "ai_report": str(result),
            "store_id": data.store_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)