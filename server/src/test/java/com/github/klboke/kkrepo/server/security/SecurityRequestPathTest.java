package com.github.klboke.kkrepo.server.security;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.mock.web.MockHttpServletRequest;

class SecurityRequestPathTest {
  @ParameterizedTest
  @CsvSource({
      "/service/rest/v1/%73ecurity/users, /service/rest/v1/security/users",
      "/service;x/rest;y/v1;z/security;w/users;q, /service/rest/v1/security/users",
      "/%69nternal/%73ecurity/ldap, /internal/security/ldap",
      "/internal/security/%2573ession, /internal/security/%73ession",
      "/internal/security/api-keys/current%2f123, /internal/security/api-keys/current%2F123",
      "/internal/security/roles/a+b, /internal/security/roles/a+b",
      "/internal/security/roles/a%3Bb, /internal/security/roles/a;b",
      "/repository/npm/@scope%2fpkg, /repository/npm/@scope%2Fpkg"
  })
  void matchesDecodedSegmentsWithoutChangingBoundariesOrOriginalUri(String raw, String expected) {
    MockHttpServletRequest request = new MockHttpServletRequest("GET", "/kkrepo" + raw);
    request.setContextPath("/kkrepo");
    assertEquals(expected, SecurityRequestPath.matchingPath(request));
    assertEquals(raw, SecurityRequestPath.rawPath(request));
    assertEquals("/kkrepo" + raw, request.getRequestURI());
  }
}
