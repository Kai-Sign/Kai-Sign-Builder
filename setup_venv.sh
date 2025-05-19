#!/bin/bash
# Setup script for Kai-Sign Python environment

# Colors for terminal output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Setting up Python environment for Kai-Sign...${NC}"

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Python 3 is not installed. Please install Python 3.9+ and try again.${NC}"
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}Creating Python virtual environment...${NC}"
    python3 -m venv venv
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to create virtual environment. Make sure python3-venv is installed.${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}Virtual environment already exists.${NC}"
fi

# Activate virtual environment
echo -e "${YELLOW}Activating virtual environment...${NC}"
source venv/bin/activate
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to activate virtual environment.${NC}"
    exit 1
fi

# Install dependencies
echo -e "${YELLOW}Installing Python dependencies...${NC}"
pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to install dependencies.${NC}"
    exit 1
fi

# Verify erc7730 installation
echo -e "${YELLOW}Verifying erc7730 installation...${NC}"
python -c "import erc7730; print(f'erc7730 {getattr(erc7730, \"__version__\", \"unknown version\")} installed successfully')"
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to import erc7730. Trying to reinstall...${NC}"
    pip install erc7730==0.3.8
    python -c "import erc7730; print(f'erc7730 {getattr(erc7730, \"__version__\", \"unknown version\")} installed successfully')"
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to install erc7730. Please check your internet connection and try again.${NC}"
        exit 1
    fi
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Creating .env file template...${NC}"
    echo "ETHERSCAN_API_KEY=your_etherscan_api_key" > .env
    echo -e "${GREEN}Created .env file. Please edit it to add your Etherscan API key.${NC}"
fi

echo -e "${GREEN}Setup complete!${NC}"
echo -e "${YELLOW}To activate the virtual environment, run:${NC}"
echo -e "  source venv/bin/activate"
echo
echo -e "${YELLOW}To run the development server:${NC}"
echo -e "  npm run dev"
echo
echo -e "${YELLOW}Don't forget to set your ETHERSCAN_API_KEY in the .env file!${NC}" 