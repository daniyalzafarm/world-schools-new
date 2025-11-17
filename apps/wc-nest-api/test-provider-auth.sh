#!/bin/bash

# Provider Authentication API Test Script
# This script tests the provider authentication endpoints

BASE_URL="http://localhost:3000"
EMAIL="test-provider@example.com"
PASSWORD="TestPassword123"

echo "========================================="
echo "Provider Authentication API Test"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Register Provider
echo -e "${YELLOW}1. Testing Provider Registration...${NC}"
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/provider/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\",
    \"firstName\": \"Test\",
    \"lastName\": \"Provider\",
    \"providerName\": \"Test School\",
    \"providerPhone\": \"+1-555-123-4567\",
    \"providerEmail\": \"contact@testschool.com\",
    \"city\": \"New York\",
    \"state\": \"NY\",
    \"country\": \"United States\"
  }")

echo "$REGISTER_RESPONSE" | jq '.'
echo ""

# Check if registration was successful
if echo "$REGISTER_RESPONSE" | jq -e '.success == true' > /dev/null; then
  echo -e "${GREEN}✓ Registration successful${NC}"
else
  echo -e "${RED}✗ Registration failed${NC}"
fi
echo ""

# 2. Prompt for verification code
echo -e "${YELLOW}2. Email Verification${NC}"
echo "Please check the email inbox for the verification code."
read -p "Enter the 6-digit verification code: " VERIFICATION_CODE
echo ""

# 3. Verify Email
echo -e "${YELLOW}3. Testing Email Verification...${NC}"
VERIFY_RESPONSE=$(curl -s -X POST "$BASE_URL/provider/auth/verify-email" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"code\": \"$VERIFICATION_CODE\"
  }")

echo "$VERIFY_RESPONSE" | jq '.'
echo ""

if echo "$VERIFY_RESPONSE" | jq -e '.success == true' > /dev/null; then
  echo -e "${GREEN}✓ Email verification successful${NC}"
else
  echo -e "${RED}✗ Email verification failed${NC}"
  exit 1
fi
echo ""

# 4. Login
echo -e "${YELLOW}4. Testing Login...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/provider/auth/login" \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\"
  }")

echo "$LOGIN_RESPONSE" | jq '.'
echo ""

if echo "$LOGIN_RESPONSE" | jq -e '.success == true' > /dev/null; then
  echo -e "${GREEN}✓ Login successful${NC}"
else
  echo -e "${RED}✗ Login failed${NC}"
  exit 1
fi
echo ""

# 5. Get Profile
echo -e "${YELLOW}5. Testing Get Profile...${NC}"
PROFILE_RESPONSE=$(curl -s -X GET "$BASE_URL/provider/auth/profile" \
  -b cookies.txt)

echo "$PROFILE_RESPONSE" | jq '.'
echo ""

if echo "$PROFILE_RESPONSE" | jq -e '.success == true' > /dev/null; then
  echo -e "${GREEN}✓ Get profile successful${NC}"
else
  echo -e "${RED}✗ Get profile failed${NC}"
fi
echo ""

# 6. Change Password
echo -e "${YELLOW}6. Testing Change Password...${NC}"
NEW_PASSWORD="NewPassword123"
CHANGE_PASSWORD_RESPONSE=$(curl -s -X PATCH "$BASE_URL/provider/auth/change-password" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d "{
    \"oldPassword\": \"$PASSWORD\",
    \"newPassword\": \"$NEW_PASSWORD\"
  }")

echo "$CHANGE_PASSWORD_RESPONSE" | jq '.'
echo ""

if echo "$CHANGE_PASSWORD_RESPONSE" | jq -e '.success == true' > /dev/null; then
  echo -e "${GREEN}✓ Change password successful${NC}"
else
  echo -e "${RED}✗ Change password failed${NC}"
fi
echo ""

# 7. Logout
echo -e "${YELLOW}7. Testing Logout...${NC}"
LOGOUT_RESPONSE=$(curl -s -X POST "$BASE_URL/provider/auth/logout" \
  -b cookies.txt)

echo "$LOGOUT_RESPONSE" | jq '.'
echo ""

if echo "$LOGOUT_RESPONSE" | jq -e '.success == true' > /dev/null; then
  echo -e "${GREEN}✓ Logout successful${NC}"
else
  echo -e "${RED}✗ Logout failed${NC}"
fi
echo ""

# 8. Test Resend Verification Code (with a new user)
echo -e "${YELLOW}8. Testing Resend Verification Code...${NC}"
NEW_EMAIL="test-resend@example.com"

# Register new user
curl -s -X POST "$BASE_URL/provider/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$NEW_EMAIL\",
    \"password\": \"$PASSWORD\",
    \"firstName\": \"Test\",
    \"lastName\": \"Resend\",
    \"providerName\": \"Test Resend School\"
  }" > /dev/null

# Resend code
RESEND_RESPONSE=$(curl -s -X POST "$BASE_URL/provider/auth/resend-verification-code" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$NEW_EMAIL\"
  }")

echo "$RESEND_RESPONSE" | jq '.'
echo ""

if echo "$RESEND_RESPONSE" | jq -e '.success == true' > /dev/null; then
  echo -e "${GREEN}✓ Resend verification code successful${NC}"
else
  echo -e "${RED}✗ Resend verification code failed${NC}"
fi
echo ""

# Cleanup
rm -f cookies.txt

echo "========================================="
echo -e "${GREEN}All tests completed!${NC}"
echo "========================================="

