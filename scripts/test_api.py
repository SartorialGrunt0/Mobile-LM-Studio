#!/usr/bin/env python3
"""
API Test Client
Tests connection to a server's API by sending a test prompt and verifying responses.
"""

import argparse
import json
import sys
from datetime import datetime

try:
    import urllib.request
    import urllib.error
except ImportError:
    print("Error: urllib is required. It's included in Python standard library.")
    sys.exit(1)


class APITestResult:
    """Stores the results of an API test."""
    def __init__(self):
        self.url: str = ""
        self.success: bool = False
        self.status_code: int = 0
        self.response_time_ms: float = 0.0
        self.response_body: str = ""
        self.error_message: str = ""
        self.timestamp: str = ""

    def __str__(self):
        status = "SUCCESS" if self.success else "FAILED"
        return (
            f"\n{'='*60}\n"
            f"  Test: {status}\n"
            f"{'='*60}\n"
            f"  URL:           {self.url}\n"
            f"  Status Code:   {self.status_code}\n"
            f"  Response Time: {self.response_time_ms:.2f} ms\n"
            f"  Timestamp:     {self.timestamp}\n"
            f"{'='*60}"
        )


def send_request(
    url: str,
    method: str = "GET",
    payload: dict = None,
    headers: dict = None,
    timeout: int = 30
) -> APITestResult:
    """Send an HTTP request and return the result."""
    result = APITestResult()
    result.url = url
    result.timestamp = datetime.now().isoformat()

    if payload:
        body = json.dumps(payload).encode('utf-8')
    else:
        body = None

    if not headers:
        headers = {}

    req = urllib.request.Request(url, data=body, method=method)
    for key, value in headers.items():
        req.add_header(key, value)

    start_time = datetime.now()

    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            end_time = datetime.now()
            result.success = 200 <= response.status < 300
            result.status_code = response.status
            result.response_time_ms = (end_time - start_time).total_seconds() * 1000
            result.response_body = response.read().decode('utf-8')
    except urllib.error.HTTPError as e:
        end_time = datetime.now()
        result.success = False
        result.status_code = e.code
        result.response_time_ms = (end_time - start_time).total_seconds() * 1000
        try:
            result.response_body = e.read().decode('utf-8')
        except Exception:
            result.response_body = str(e)
        result.error_message = f"HTTP {e.code}: {e.reason}"
    except urllib.error.URLError as e:
        end_time = datetime.now()
        result.success = False
        result.response_time_ms = (end_time - start_time).total_seconds() * 1000
        result.error_message = f"Connection failed: {e.reason}"
        result.response_body = ""
    except TimeoutError:
        end_time = datetime.now()
        result.success = False
        result.response_time_ms = (end_time - start_time).total_seconds() * 1000
        result.error_message = f"Request timed out after {timeout} seconds"
        result.response_body = ""
    except Exception as e:
        end_time = datetime.now()
        result.success = False
        result.response_time_ms = (end_time - start_time).total_seconds() * 1000
        result.error_message = str(e)
        result.response_body = ""

    return result


def print_result(result: APITestResult, verbose: bool = False):
    """Print test results in a readable format."""
    print(result)

    if result.success:
        print("  Status: PASSED ✓")
    else:
        print(f"  Status: FAILED ✗")
        if result.error_message:
            print(f"  Error:  {result.error_message}")

    if verbose and result.response_body:
        print(f"\n  Response Body:")
        try:
            parsed = json.loads(result.response_body)
            print(f"  {json.dumps(parsed, indent=4)}")
        except (json.JSONDecodeError, TypeError):
            print(f"  {result.response_body}")
    print()


def test_generic_api(
    url: str,
    method: str,
    payload: dict,
    headers: dict,
    timeout: int,
    verbose: bool
) -> APITestResult:
    """Test a generic REST API endpoint."""
    print(f"\n  Testing generic API endpoint...")
    print(f"  Method: {method}")
    print(f"  URL:    {url}")
    if payload:
        print(f"  Payload: {json.dumps(payload, indent=4)}")
    print()

    result = send_request(url, method, payload, headers, timeout)
    print_result(result, verbose)
    return result


def test_openai_compatible(
    url: str,
    model: str,
    max_tokens: int,
    temperature: float,
    timeout: int,
    verbose: bool
) -> APITestResult:
    """Test an OpenAI-compatible chat completions API."""
    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Say hello in exactly 5 words. Be creative."}
    ]

    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature
    }

    headers = {"Content-Type": "application/json"}

    print(f"\n  Testing OpenAI-compatible Chat Completions API...")
    print(f"  URL:        {url}/chat/completions")
    print(f"  Model:      {model}")
    print(f"  Max Tokens: {max_tokens}")
    print(f"  Temperature:{temperature}")
    print()

    result = send_request(
        f"{url}/chat/completions",
        "POST",
        payload,
        headers,
        timeout
    )

    print_result(result, verbose)

    if result.success and result.response_body:
        try:
            data = json.loads(result.response_body)
            choices = data.get("choices", [])
            if choices:
                assistant_msg = choices[0].get("message", {})
                content = assistant_msg.get("content", "")
                print(f"  Assistant Response: \"{content}\"")

                usage = data.get("usage", {})
                if usage:
                    print(f"\n  Token Usage:")
                    print(f"    Prompt:     {usage.get('prompt_tokens', 'N/A')}")
                    print(f"    Completion: {usage.get('completion_tokens', 'N/A')}")
                    print(f"    Total:      {usage.get('total_tokens', 'N/A')}")
        except (json.JSONDecodeError, KeyError):
            pass

    return result


def test_ollama_api(url: str, timeout: int, verbose: bool) -> APITestResult:
    """Test an Ollama API endpoint."""
    payload = {
        "model": "",
        "messages": [
            {"role": "user", "content": "Say hi in exactly 3 words."}
        ],
        "stream": False
    }

    headers = {"Content-Type": "application/json"}

    print(f"\n  Testing Ollama API...")
    print(f"  URL: {url}/chat")
    print()

    result = send_request(f"{url}/chat", "POST", payload, headers, timeout)
    print_result(result, verbose)

    if result.success and result.response_body:
        try:
            data = json.loads(result.response_body)
            content = data.get("message", {}).get("content", "")
            print(f"  Assistant Response: \"{content}\"")
        except (json.JSONDecodeError, KeyError):
            pass

    return result


def test_health_check(url: str, timeout: int, verbose: bool) -> APITestResult:
    """Test a simple health check endpoint."""
    print(f"\n  Testing Health Check endpoint...")
    print(f"  URL: {url}")
    print()

    result = send_request(url, "GET", None, {}, timeout)
    print_result(result, verbose)
    return result


def main():
    parser = argparse.ArgumentParser(
        description="API Test Client - Send test requests to an API server",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
examples:
  # Test OpenAI-compatible API
  %(prog)s --openai http://localhost:1234/v1 --model hermes3

  # Test Ollama API
  %(prog)s --ollama http://localhost:11434

  # Test generic endpoint
  %(prog)s --url http://localhost:8080/health

  # Test with custom payload
  %(prog)s --openai http://localhost:1234/v1 --model hermes3 \\
      --payload '{"max_tokens": 100, "custom_prompt": "Hello"}' --verbose
        """
    )

    # API type arguments (mutually exclusive)
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--url", help="Generic URL to test with GET request")
    group.add_argument("--openai", help="OpenAI-compatible API base URL")
    group.add_argument("--ollama", help="Ollama API base URL")

    # OpenAI-specific options
    parser.add_argument("--model", default="default", help="Model name for OpenAI API (default: default)")
    parser.add_argument("--max-tokens", type=int, default=200, help="Max tokens for OpenAI API (default: 200)")
    parser.add_argument("--temperature", type=float, default=0.7, help="Temperature for OpenAI API (default: 0.7)")

    # Common options
    parser.add_argument("--method", default="GET", help="HTTP method for --url (default: GET)")
    parser.add_argument("--payload", help="JSON payload string for --url")
    parser.add_argument("--header", action="append", help="Additional headers (key:value)")
    parser.add_argument("--timeout", type=int, default=30, help="Request timeout in seconds (default: 30)")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show full response body")
    parser.add_argument("--output", help="Save response to a file")

    args = parser.parse_args()

    print("  ╔══════════════════════════════════════════════════════════╗")
    print("  ║          API Test Client - Mobile-AI-Chat                ║")
    print("  ╚══════════════════════════════════════════════════════════╝")

    if not args.url and not args.openai and not args.ollama:
        parser.print_help()
        sys.exit(1)

    all_results = []

    if args.openai:
        result = test_openai_compatible(
            args.openai.rstrip('/'),
            args.model,
            args.max_tokens,
            args.temperature,
            args.timeout,
            args.verbose
        )
        all_results.append(result)
        if args.output:
            with open(args.output, 'w') as f:
                f.write(result.response_body)
            print(f"  Response saved to: {args.output}")

    if args.ollama:
        result = test_ollama_api(
            args.ollama.rstrip('/'),
            args.timeout,
            args.verbose
        )
        all_results.append(result)

    if args.url:
        custom_payload = None
        custom_headers = {"Content-Type": "application/json"}

        if args.payload:
            custom_payload = json.loads(args.payload)

        if args.header:
            for h in args.header:
                if ':' in h:
                    key, value = h.split(':', 1)
                    custom_headers[key.strip()] = value.strip()

        result = test_generic_api(
            args.url,
            args.method,
            custom_payload,
            custom_headers,
            args.timeout,
            args.verbose
        )
        all_results.append(result)

    # Summary
    passed = sum(1 for r in all_results if r.success)
    total = len(all_results)
    print(f"  Summary: {passed}/{total} tests passed")

    if passed != total:
        sys.exit(1)


if __name__ == "__main__":
    main()