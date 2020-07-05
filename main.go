package main

import (
	"fmt"
	"net/http"

	"github.com/labstack/echo"
	"github.com/phuwn/tools/handler"
	mw "github.com/phuwn/tools/middleware"

	"github.com/phuwn/go-video-conference/ws"
)

// JSON - shorcut for handler.JSON function
var JSON = handler.JSON

func router() *echo.Echo {
	r := echo.New()
	r.HTTPErrorHandler = handler.JSONError
	r.Pre(mw.RemoveTrailingSlash)
	{
		r.Use(mw.CorsConfig())
	}
	r.Static("/", "assets")
	r.GET("/ws", serveWs)

	return r
}

func serveWs(c echo.Context) error {
	ws.Serve(c.Response().Writer, c.Request())
	return nil
}

func main() {
	addr := ":9988"
	fmt.Printf("listening on port %s\n", addr)
	go ws.NewHub()

	err := http.ListenAndServe(addr, router())
	if err != nil {
		fmt.Printf("server got terminated, err: %s\n", err.Error())
	}
}
