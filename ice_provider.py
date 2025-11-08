import os
import json
from twilio.rest import Client
from twilio.base.exceptions import TwilioException

CONFIG_FILE = "ice_servers.json"

def _get_twilio_servers():

    account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN")

    if not account_sid or not auth_token:
        print("Twilio credentials not found in environment variables.")
        return []

    try:
        client = Client(account_sid, auth_token)

        token = client.tokens.create(ttl=86400)
        print("Successfully fetched ICE servers from Twilio.")

        augmented_servers = []
        for server in token.ice_servers:
            server['region'] = 'global'
            server['provider'] = 'twilio.com'
            augmented_servers.append(server)
        return augmented_servers
    except TwilioException as e:
        print(f"Failed to get ICE servers from Twilio: {e}")
        return []
    except Exception as e:
        print(f"An unexpected error occurred while contacting Twilio: {e}")
        return []

def get_ice_servers():

    ice_servers_list = []

    try:
        with open(CONFIG_FILE, 'r') as f:
            config = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"CRITICAL: Could not load or parse '{CONFIG_FILE}': {e}")
        print("Falling back to a single public STUN server.")
        return [{"urls": "stun:stun.l.google.com:19302", "region": "global", "source": "google.com"}]


    stun_servers = config.get("stun_servers", [])
    if stun_servers:
      
        ice_servers_list.extend(stun_servers)
    print(f"Loaded {len(stun_servers)} public STUN servers.")

    turn_providers = config.get("turn_providers", [])
    for provider in turn_providers:
        provider_name = provider.get("provider")
        
        if provider_name == "twilio":
            twilio_servers = _get_twilio_servers()
            if twilio_servers:
                ice_servers_list.extend(twilio_servers)
        
        elif 
            pass

    if not ice_servers_list:
        print("WARNING: No ICE servers could be configured. Using fallback.")
        return [{"urls": "stun:stun.l.google.com:19302", "region": "global", "source": "google.com"}]

    print(f"Total configured ICE servers: {len(ice_servers_list)}")
    return ice_servers_list