import azure.functions as func

from main import app as fastapi_app 

# FastAPI のアプリを、そのまま Functions の HTTP の入口につなぐ（main.py は変えない） 
app = func.AsgiFunctionApp(app=fastapi_app, http_auth_level=func.AuthLevel.ANONYMOUS) 