import { HashRouter, Route, Routes, Navigate } from "react-router-dom";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import DigestHub from "@/pages/DigestHub";
import DigestDate from "@/pages/DigestDate";
import Builders from "@/pages/Builders";
import BuilderDetail from "@/pages/BuilderDetail";
import Discussions from "@/pages/Discussions";
import Me from "@/pages/Me";
import SearchPage from "@/pages/SearchPage";
import { FeedProvider } from "@/lib/FeedProvider";
import { AnnotationDrawerProvider } from "@/components/AnnotationDrawerContext";
import AnnotationDrawer from "@/components/AnnotationDrawer";
import { AuthProvider } from "@/lib/auth";

function App() {
  return (
    <AuthProvider>
    <FeedProvider>
      <HashRouter>
        <AnnotationDrawerProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="digest" element={<DigestHub />} />
              <Route path="digest/today" element={<DigestDate />} />
              <Route path="digest/:date" element={<DigestDate />} />
              <Route path="builders" element={<Builders />} />
              <Route path="builders/:handle" element={<BuilderDetail />} />
              <Route path="discussions" element={<Discussions />} />
              <Route path="me" element={<Me />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
          <AnnotationDrawer />
        </AnnotationDrawerProvider>
      </HashRouter>
    </FeedProvider>
    </AuthProvider>
  );
}

export default App;
