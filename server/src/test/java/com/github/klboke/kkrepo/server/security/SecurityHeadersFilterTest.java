package com.github.klboke.kkrepo.server.security;

import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class SecurityHeadersFilterTest {
  @Test
  void contentSecurityPolicyBlocksInlineScripts() throws Exception {
    MockHttpServletResponse response = new MockHttpServletResponse();

    new SecurityHeadersFilter(false).doFilter(
        new MockHttpServletRequest("GET", "/browse/"),
        response,
        (request, filteredResponse) -> {
        });

    String csp = response.getHeader("Content-Security-Policy");
    assertTrue(csp.contains("script-src 'self'"));
    assertTrue(csp.contains("frame-ancestors 'none'"));
  }
}
