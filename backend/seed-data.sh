#!/bin/bash

# Script pentru seed-ing de date în BoardShip
# Asigură-te că backend-ul rulează înainte de a executa acest script

BASE_URL="http://localhost:8080/api/admin/seed"

# Culori pentru output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}======================================${NC}"
echo -e "${YELLOW}  BoardShip Data Seeder Script${NC}"
echo -e "${YELLOW}======================================${NC}"
echo ""

# Verifică dacă backend-ul rulează
echo "Verificăm dacă backend-ul rulează..."
if ! curl -s "$BASE_URL" > /dev/null 2>&1; then
    echo -e "${RED}❌ Backend-ul nu răspunde la $BASE_URL${NC}"
    echo -e "${YELLOW}Asigură-te că backend-ul rulează pe portul 8080${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Backend-ul este activ${NC}"
echo ""

# Meniu
echo "Alege o opțiune:"
echo "1) Seed rapid (50 utilizatori cu istoric random)"
echo "2) Seed custom (specifică numărul de utilizatori)"
echo "3) Seed balansat (specifică utilizatori pe nivel de skill)"
echo "4) Șterge toate datele (USE WITH CAUTION!)"
echo "5) Exit"
echo ""
read -p "Introdu opțiunea (1-5): " option

case $option in
    1)
        echo -e "${YELLOW}Generez 50 utilizatori cu istoric random...${NC}"
        response=$(curl -s -X POST "$BASE_URL/quick")
        if [[ $response == *"success\":true"* ]]; then
            echo -e "${GREEN}✓ Seed finalizat cu succes!${NC}"
            echo "$response" | grep -o '"message":"[^"]*"' | sed 's/"message":"\(.*\)"/\1/'
        else
            echo -e "${RED}❌ Eroare la seed!${NC}"
            echo "$response"
        fi
        ;;

    2)
        read -p "Câți utilizatori vrei să generezi? (1-500): " count
        if ! [[ "$count" =~ ^[0-9]+$ ]] || [ "$count" -lt 1 ] || [ "$count" -gt 500 ]; then
            echo -e "${RED}❌ Număr invalid! Trebuie să fie între 1 și 500.${NC}"
            exit 1
        fi
        echo -e "${YELLOW}Generez $count utilizatori cu istoric random...${NC}"
        response=$(curl -s -X POST "$BASE_URL/users?count=$count")
        if [[ $response == *"success\":true"* ]]; then
            echo -e "${GREEN}✓ Seed finalizat cu succes!${NC}"
            echo "$response" | grep -o '"message":"[^"]*"' | sed 's/"message":"\(.*\)"/\1/'
        else
            echo -e "${RED}❌ Eroare la seed!${NC}"
            echo "$response"
        fi
        ;;

    3)
        echo "Introdu numărul de utilizatori pe nivel:"
        read -p "  Începători (500-900 RP): " beginners
        read -p "  Intermediari (900-1300 RP): " intermediate
        read -p "  Avansați (1300-1700 RP): " advanced
        read -p "  Experți (1700-2500 RP): " experts

        total=$((beginners + intermediate + advanced + experts))
        echo -e "${YELLOW}Generez $total utilizatori balansat pe nivele...${NC}"

        response=$(curl -s -X POST "$BASE_URL/balanced?beginners=$beginners&intermediate=$intermediate&advanced=$advanced&experts=$experts")
        if [[ $response == *"success\":true"* ]]; then
            echo -e "${GREEN}✓ Seed finalizat cu succes!${NC}"
            echo "$response" | grep -o '"message":"[^"]*"' | sed 's/"message":"\(.*\)"/\1/'
        else
            echo -e "${RED}❌ Eroare la seed!${NC}"
            echo "$response"
        fi
        ;;

    4)
        echo -e "${RED}⚠️  ATENȚIE: Această acțiune va șterge TOȚI utilizatorii și meciurile!${NC}"
        read -p "Ești sigur? Tastează 'DELETE' pentru confirmare: " confirm
        if [ "$confirm" == "DELETE" ]; then
            echo -e "${YELLOW}Șterg toate datele...${NC}"
            response=$(curl -s -X DELETE "$BASE_URL/clear")
            if [[ $response == *"success\":true"* ]]; then
                echo -e "${GREEN}✓ Toate datele au fost șterse!${NC}"
            else
                echo -e "${RED}❌ Eroare la ștergere!${NC}"
                echo "$response"
            fi
        else
            echo -e "${YELLOW}Acțiune anulată.${NC}"
        fi
        ;;

    5)
        echo "Bye!"
        exit 0
        ;;

    *)
        echo -e "${RED}❌ Opțiune invalidă!${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  Seed completat!${NC}"
echo -e "${GREEN}======================================${NC}"

