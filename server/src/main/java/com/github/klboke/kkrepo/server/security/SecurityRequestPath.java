package com.github.klboke.kkrepo.server.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.server.PathContainer;

/** Request-local path interpretation shared by management security filters. */
final class SecurityRequestPath {
  private SecurityRequestPath() {
  }

  static String matchingPath(HttpServletRequest request) {
    StringBuilder path = new StringBuilder();
    // Match MVC's PathPattern semantics: decode each segment once and remove matrix parameters.
    // A decoded slash inside a segment must never become a routing separator (or an exemption).
    for (PathContainer.Element element : PathContainer.parsePath(rawPath(request)).elements()) {
      if (element instanceof PathContainer.PathSegment segment) {
        path.append(segment.valueToMatch().replace("/", "%2F"));
      } else {
        path.append(element.value());
      }
    }
    return path.toString();
  }

  static String rawPath(HttpServletRequest request) {
    String uri = request.getRequestURI();
    String contextPath = request.getContextPath();
    if (contextPath != null && !contextPath.isBlank() && uri.startsWith(contextPath)) {
      return uri.substring(contextPath.length());
    }
    return uri;
  }
}
