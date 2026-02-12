package security

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"log"
)

const rsaPublicKeyPEM = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAsn1PP+88xIl+KYuWm8cJ
sAVA1bSomMqoTuDDkwuGL+S69A5hmK58yoWsc9T/Mx6zMHpCoZfnYXd3/w1qqRrb
vmKTONCll4GmEHaHWfiondWTZHucc9lmN0CjbmHYPnzC3cQCxguZgTfGU+UXbfnn
KOenBKC/gZ+qtfWnA5unt2Fly5fAfFDX4Tce+uUCRzKm8ggDdqnbvylsfMG8CCfo
i+88tBOC7FcmpRu1rsdurqylrJTXzM4JTod3hClLxQrjNztZlk+RZiAZqd1NKsfW
krdH6v5QHK92JDI7ZuVF/LXZDdtQ5yv6gHNetBHBpsrnovj3jGWUJ/rgI07t7hF3
y/nn2oySOVArw6MY61GqUkM9oi7ORSv9oQirNF3ut2KSR/47QW19kQQWudoREVWa
fDwov4VVymHgrDMh86o22J+IN1Lv7jB9RZQsQefipxWRWdZBwjeI7WAB06Jh5btf
ec+hrcfVyT4zv4rKFN5nrC510hkzbkXmTTOQyjyX3za6HZsl4mZvjV1R9oIIeSsw
bSJwkyP3UG+0Yc+7LyXrsJ9yXQGR5T3blmZAO8IovDJwyELd6OJb32lz92M1D27Z
7CiIIBAjAarZKjZVoxcGTZRJl5pypnGs8igtJpEF093AumHvGgjWLvwI91+7SFOH
EWDh+BqWsaiLVMWeIqZwhf8CAwEAAQ==
-----END PUBLIC KEY-----`

var rsaPublicKey *rsa.PublicKey

func init() {
	block, _ := pem.Decode([]byte(rsaPublicKeyPEM))
	if block == nil {
		log.Fatal("failed to decode RSA public key PEM")
	}

	pub, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		log.Fatal("failed to parse RSA public key: ", err)
	}

	key, ok := pub.(*rsa.PublicKey)
	if !ok {
		log.Fatal("key is not RSA public key")
	}

	rsaPublicKey = key
}

func GetRSAPublicKey() *rsa.PublicKey {
	return rsaPublicKey
}
